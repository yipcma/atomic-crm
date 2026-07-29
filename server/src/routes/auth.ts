import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { query } from "../db.js";
import { verifyPassword } from "../auth/password.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../auth/jwt.js";
import {
  countUsers,
  createSalesUser,
  type SaleRow,
} from "../services/salesUser.js";

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

// First-run bootstrap: creates the initial administrator. Disabled once any
// user exists (further accounts are created by admins via /api/users).
authRoutes.post("/signup", async (c) => {
  if ((await countUsers()) > 0) {
    throw new HTTPException(403, {
      message: "Application already initialized",
    });
  }
  const { email, password, first_name, last_name } = await c.req.json<{
    email?: string;
    password?: string;
    first_name?: string;
    last_name?: string;
  }>();
  if (!email || !password) {
    throw new HTTPException(400, {
      message: "Email and password are required",
    });
  }

  const { sale } = await createSalesUser({
    email,
    password,
    first_name: first_name ?? "",
    last_name: last_name ?? "",
    administrator: true,
    disabled: false,
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
