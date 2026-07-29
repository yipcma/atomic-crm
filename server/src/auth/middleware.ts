import type { Context, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { query } from "../db.js";
import { verifyAccessToken } from "./jwt.js";
import type { CurrentSale } from "./context.js";

async function loadSale(userId: string): Promise<CurrentSale | undefined> {
  const { rows } = await query<CurrentSale>(
    "select id, administrator, disabled from public.sales where user_id = $1",
    [userId],
  );
  return rows[0];
}

// Authenticates the request from the Bearer token and loads the current sale.
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    throw new HTTPException(401, { message: "Missing authentication token" });
  }

  let userId: string;
  try {
    const claims = await verifyAccessToken(token);
    userId = claims.sub;
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }

  const sale = await loadSale(userId);
  if (!sale) {
    throw new HTTPException(401, { message: "Account not found" });
  }
  if (sale.disabled) {
    throw new HTTPException(403, { message: "Account disabled" });
  }

  c.set("userId", userId);
  c.set("sale", sale);
  await next();
};

export function requireAdmin(c: Context): void {
  if (!c.get("sale")?.administrator) {
    throw new HTTPException(403, { message: "Administrator access required" });
  }
}
