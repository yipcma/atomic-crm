import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { query } from "../db.js";
import { requireAdmin } from "../auth/middleware.js";
import { signInviteToken, signSignupInviteToken } from "../auth/jwt.js";
import {
  createSalesUser,
  deleteSalesUser,
  saleUserId,
  updateSalesUser,
  type SaleRow,
} from "../services/salesUser.js";
import { isEmailEnabled, sendPasswordResetEmail } from "../email.js";
import { dataRoutes } from "./data.js";

function identityFrom(sale: SaleRow, superAdmin: boolean) {
  const avatar =
    sale.avatar && typeof sale.avatar === "object"
      ? (sale.avatar as { src?: string }).src
      : undefined;
  return {
    id: sale.id,
    fullName: `${sale.first_name} ${sale.last_name}`,
    avatar,
    administrator: sale.administrator,
    super_admin: superAdmin,
  };
}

// All routes here run behind requireAuth (mounted in index.ts).
export const protectedRoutes = new Hono();

protectedRoutes.get("/auth/identity", async (c) => {
  const saleId = c.get("sale").id;
  const { rows } = await query<SaleRow>(
    "select * from public.sales where id = $1",
    [saleId],
  );
  if (!rows[0]) {
    throw new HTTPException(404, { message: "Account not found" });
  }
  return c.json(identityFrom(rows[0], c.get("sale").superAdmin));
});

// Create an account manager (formerly the "users" edge function, POST).
protectedRoutes.post("/users", async (c) => {
  requireAdmin(c);
  const body = await c.req.json<{
    email: string;
    first_name: string;
    last_name: string;
    administrator?: boolean;
    disabled?: boolean;
    avatar?: unknown;
    password?: string;
  }>();

  const { sale } = await createSalesUser({
    email: body.email,
    first_name: body.first_name,
    last_name: body.last_name,
    administrator: body.administrator ?? false,
    disabled: body.disabled ?? false,
    avatar: body.avatar,
    password: body.password,
    organizationId: c.get("sale").organization_id,
  });

  // The new user has no usable password yet; they set one via this invite token.
  const inviteToken = await signInviteToken(sale.user_id);
  return c.json({ data: sale, invite_token: inviteToken }, 201);
});

// Generate a generic, shareable self-registration invite link (admin only).
protectedRoutes.post("/users/generic-invite", async (c) => {
  requireAdmin(c);
  const inviteToken = await signSignupInviteToken(
    c.get("sale").organization_id,
  );
  return c.json({ invite_token: inviteToken });
});

// Delete an account manager (admin only). Owned records are kept but unassigned.
protectedRoutes.delete("/users/:id", async (c) => {
  requireAdmin(c);
  const sale = c.get("sale");
  await deleteSalesUser(c.req.param("id"), sale.id, sale.organization_id);
  return c.json({ data: { id: c.req.param("id") } });
});

// Update an account manager (formerly the "users" edge function, PATCH).
protectedRoutes.patch("/users", async (c) => {
  requireAdmin(c);
  const body = await c.req.json<{
    sales_id: string | number;
    email?: string;
    first_name?: string;
    last_name?: string;
    administrator?: boolean;
    disabled?: boolean;
    avatar?: unknown;
  }>();

  const sale = await updateSalesUser(
    String(body.sales_id),
    {
      email: body.email,
      first_name: body.first_name,
      last_name: body.last_name,
      administrator: body.administrator,
      disabled: body.disabled,
      avatar: body.avatar,
    },
    c.get("sale").organization_id,
  );

  return c.json({ data: sale });
});

// Reset a password (self-service, or admin for anyone). Emails a reset link when
// email is configured; otherwise returns the token so the UI can show a link.
protectedRoutes.patch("/update_password", async (c) => {
  const { sales_id } = await c.req.json<{ sales_id: string | number }>();
  const targetId = String(sales_id);
  const current = c.get("sale");
  if (!current.administrator && String(current.id) !== targetId) {
    throw new HTTPException(403, {
      message: "You can only reset your own password",
    });
  }
  const userId = await saleUserId(targetId, current.organization_id);
  const inviteToken = await signInviteToken(userId);

  if (isEmailEnabled()) {
    const { rows } = await query<{ email: string }>(
      "select email from public.sales where id = $1 and organization_id = $2",
      [targetId, current.organization_id],
    );
    const email = rows[0]?.email;
    if (email) {
      try {
        await sendPasswordResetEmail(email, inviteToken);
        return c.json({ data: true, emailed: true });
      } catch (error) {
        console.error("password reset email failed:", error);
      }
    }
  }
  return c.json({ data: true, emailed: false, invite_token: inviteToken });
});

// Merge two contacts (formerly the "merge_contacts" edge function).
protectedRoutes.post("/merge_contacts", async (c) => {
  const { loserId, winnerId } = await c.req.json<{
    loserId: number;
    winnerId: number;
  }>();
  if (loserId == null || winnerId == null) {
    throw new HTTPException(400, {
      message: "loserId and winnerId are required",
    });
  }
  // Ensure both contacts belong to the caller's organization before merging.
  const orgId = c.get("sale").organization_id;
  const { rows } = await query<{ count: number }>(
    "select count(*)::int as count from public.contacts where id = any($1) and organization_id = $2",
    [[loserId, winnerId], orgId],
  );
  if ((rows[0]?.count ?? 0) !== 2) {
    throw new HTTPException(404, { message: "Contact not found" });
  }
  await query("select public.merge_contacts($1, $2)", [loserId, winnerId]);
  return c.json({ success: true, winnerId });
});

// Generic resource CRUD is registered last so its /:resource catch-all does
// not shadow the specific routes above.
protectedRoutes.route("/", dataRoutes);
