import type { Context, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { query } from "../db.js";
import { env } from "../env.js";
import { verifyAccessToken } from "./jwt.js";
import type { CurrentSale } from "./context.js";

interface SaleRow {
  id: number;
  administrator: boolean;
  disabled: boolean;
  organization_id: number;
  email: string;
  org_disabled: boolean;
}

export function isSuperAdmin(email: string): boolean {
  return env.superAdminEmails.includes(email.toLowerCase());
}

async function loadSale(userId: string): Promise<SaleRow | undefined> {
  const { rows } = await query<SaleRow>(
    `select s.id, s.administrator, s.disabled, s.organization_id, s.email,
            o.disabled as org_disabled
     from public.sales s
     join public.organizations o on o.id = s.organization_id
     where s.user_id = $1`,
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

  const row = await loadSale(userId);
  if (!row) {
    throw new HTTPException(401, { message: "Account not found" });
  }
  if (row.disabled) {
    throw new HTTPException(403, { message: "Account disabled" });
  }
  const superAdmin = isSuperAdmin(row.email);
  if (row.org_disabled && !superAdmin) {
    throw new HTTPException(403, { message: "Organization disabled" });
  }

  const sale: CurrentSale = {
    id: row.id,
    administrator: row.administrator,
    disabled: row.disabled,
    organization_id: row.organization_id,
    email: row.email,
    superAdmin,
  };
  c.set("userId", userId);
  c.set("sale", sale);
  await next();
};

export function requireAdmin(c: Context): void {
  if (!c.get("sale")?.administrator) {
    throw new HTTPException(403, { message: "Administrator access required" });
  }
}
