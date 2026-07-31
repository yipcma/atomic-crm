import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { query } from "../db.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import {
  signAccessToken,
  signInviteToken,
  signRefreshToken,
  verifyInviteToken,
  verifyRefreshToken,
  verifySignupInviteToken,
} from "../auth/jwt.js";
import {
  createOrganization,
  createSalesUser,
  type SaleRow,
} from "../services/salesUser.js";
import { isEmailEnabled, sendPasswordResetEmail } from "../email.js";

interface UserRow {
  id: string;
  encrypted_password: string;
}

function toIdentity(sale: SaleRow) {
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

async function saleForUser(userId: string): Promise<SaleRow | undefined> {
  const { rows } = await query<SaleRow>(
    "select * from public.sales where user_id = $1",
    [userId],
  );
  return rows[0];
}

// Public authentication endpoints (no bearer token required).
export const authRoutes = new Hono();

authRoutes.post("/login", async (c) => {
  const { email, password } = await c.req.json<{
    email?: string;
    password?: string;
  }>();
  if (!email || !password) {
    throw new HTTPException(400, {
      message: "Email and password are required",
    });
  }

  const { rows } = await query<UserRow>(
    "select id, encrypted_password from public.users where email = $1",
    [email],
  );
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.encrypted_password))) {
    throw new HTTPException(401, { message: "Invalid credentials" });
  }

  const sale = await saleForUser(user.id);
  if (!sale) {
    throw new HTTPException(401, { message: "Account not found" });
  }
  if (sale.disabled) {
    throw new HTTPException(403, { message: "Account disabled" });
  }

  return c.json({
    access_token: await signAccessToken(user.id),
    refresh_token: await signRefreshToken(user.id),
    identity: toIdentity(sale),
  });
});

authRoutes.post("/refresh", async (c) => {
  const { refresh_token } = await c.req.json<{ refresh_token?: string }>();
  if (!refresh_token) {
    throw new HTTPException(400, { message: "Missing refresh token" });
  }
  let userId: string;
  try {
    userId = (await verifyRefreshToken(refresh_token)).sub;
  } catch {
    throw new HTTPException(401, { message: "Invalid refresh token" });
  }
  const sale = await saleForUser(userId);
  if (!sale || sale.disabled) {
    throw new HTTPException(401, { message: "Account unavailable" });
  }
  return c.json({ access_token: await signAccessToken(userId) });
});

// Open self-serve sign-up: creates a NEW organization and its first admin.
authRoutes.post("/signup", async (c) => {
  const { email, password, first_name, last_name, organization_name } =
    await c.req.json<{
      email?: string;
      password?: string;
      first_name?: string;
      last_name?: string;
      organization_name?: string;
    }>();
  if (!email || !password) {
    throw new HTTPException(400, {
      message: "Email and password are required",
    });
  }
  if (password.length < 8) {
    throw new HTTPException(400, {
      message: "Password must be at least 8 characters",
    });
  }

  const orgName =
    organization_name?.trim() ||
    (first_name ? `${first_name}'s Organization` : "My Organization");
  const organizationId = await createOrganization(orgName);

  const { sale } = await createSalesUser({
    email,
    password,
    first_name: first_name ?? "",
    last_name: last_name ?? "",
    administrator: true,
    disabled: false,
    organizationId,
  });

  return c.json(
    {
      access_token: await signAccessToken(sale.user_id),
      refresh_token: await signRefreshToken(sale.user_id),
      identity: toIdentity(sale),
    },
    201,
  );
});

// Public password-reset request. Always returns ok (no account enumeration);
// emails a reset link only when the account exists and email is configured.
authRoutes.post("/forgot-password", async (c) => {
  const { email } = await c.req.json<{ email?: string }>();
  if (email && isEmailEnabled()) {
    const { rows } = await query<{ id: string }>(
      "select id from public.users where email = $1",
      [email],
    );
    const user = rows[0];
    if (user) {
      try {
        await sendPasswordResetEmail(email, await signInviteToken(user.id));
      } catch (error) {
        console.error("forgot-password email failed:", error);
      }
    }
  }
  return c.json({ ok: true });
});

// Self-registration via a generic shared invite link (non-admin accounts).
authRoutes.post("/register", async (c) => {
  const { token, email, password, first_name, last_name } = await c.req.json<{
    token?: string;
    email?: string;
    password?: string;
    first_name?: string;
    last_name?: string;
  }>();
  if (!token) {
    throw new HTTPException(400, { message: "Missing invite token" });
  }
  let organizationId: number;
  try {
    organizationId = (await verifySignupInviteToken(token)).org;
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired invite link" });
  }
  if (!email || !password) {
    throw new HTTPException(400, {
      message: "Email and password are required",
    });
  }
  if (password.length < 8) {
    throw new HTTPException(400, {
      message: "Password must be at least 8 characters",
    });
  }

  const { sale } = await createSalesUser({
    email,
    password,
    first_name: first_name ?? "",
    last_name: last_name ?? "",
    administrator: false,
    disabled: false,
    organizationId,
  });

  return c.json(
    {
      access_token: await signAccessToken(sale.user_id),
      refresh_token: await signRefreshToken(sale.user_id),
      identity: toIdentity(sale),
    },
    201,
  );
});

// Accept an invite / set a new password from a shared link token, then log in.
authRoutes.post("/set-password", async (c) => {
  const { token, password } = await c.req.json<{
    token?: string;
    password?: string;
  }>();
  if (!token || !password) {
    throw new HTTPException(400, {
      message: "Token and password are required",
    });
  }
  if (password.length < 8) {
    throw new HTTPException(400, {
      message: "Password must be at least 8 characters",
    });
  }

  let userId: string;
  try {
    userId = (await verifyInviteToken(token)).sub;
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired link" });
  }

  const encrypted = await hashPassword(password);
  const updated = await query(
    "update public.users set encrypted_password = $1 where id = $2 returning id",
    [encrypted, userId],
  );
  if (!updated.rowCount) {
    throw new HTTPException(404, { message: "Account not found" });
  }

  const sale = await saleForUser(userId);
  if (!sale) {
    throw new HTTPException(404, { message: "Account not found" });
  }
  if (sale.disabled) {
    throw new HTTPException(403, { message: "Account disabled" });
  }

  return c.json({
    access_token: await signAccessToken(userId),
    refresh_token: await signRefreshToken(userId),
    identity: toIdentity(sale),
  });
});
