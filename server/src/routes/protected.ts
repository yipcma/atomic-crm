import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { query } from "../db.js";
import { requireAdmin } from "../auth/middleware.js";
import { signInviteToken } from "../auth/jwt.js";
import {
  createSalesUser,
  saleUserId,
  updateSalesUser,
  type SaleRow,
} from "../services/salesUser.js";
import { dataRoutes } from "./data.js";

function identityFrom(sale: SaleRow) {
  const avatar =
    sale.avatar && typeof sale.avatar === "object"
      ? (sale.avatar as { src?: string }).src
      : undefined;
  return {
    id: sale.id,
    fullName: `${sale.first_name} ${sale.last_name}`,
    avatar,
    administrator: sale.administrator,
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
  return c.json(identityFrom(rows[0]));
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
  });

  // The new user has no usable password yet; they set one via this invite token.
  const inviteToken = await signInviteToken(sale.user_id);
  return c.json({ data: sale, invite_token: inviteToken }, 201);
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

  const sale = await updateSalesUser(String(body.sales_id), {
    email: body.email,
    first_name: body.first_name,
    last_name: body.last_name,
    administrator: body.administrator,
    disabled: body.disabled,
    avatar: body.avatar,
  });

  return c.json({ data: sale });
});

// Generate a set-password link for a user (self-service, or admin for anyone).
// Returns an invite token the caller turns into a shareable /set-password URL.
protectedRoutes.patch("/update_password", async (c) => {
  const { sales_id } = await c.req.json<{ sales_id: string | number }>();
  const targetId = String(sales_id);
  const current = c.get("sale");
  if (!current.administrator && String(current.id) !== targetId) {
    throw new HTTPException(403, {
      message: "You can only reset your own password",
    });
  }
  const userId = await saleUserId(targetId);
  const inviteToken = await signInviteToken(userId);
  return c.json({ data: true, invite_token: inviteToken });
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
  await query("select public.merge_contacts($1, $2)", [loserId, winnerId]);
  return c.json({ success: true, winnerId });
});

// Generic resource CRUD is registered last so its /:resource catch-all does
// not shadow the specific routes above.
protectedRoutes.route("/", dataRoutes);
