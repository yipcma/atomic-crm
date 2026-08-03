import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import { query } from "../db.js";

function requireSuperAdmin(c: Context): void {
  if (!c.get("sale")?.superAdmin) {
    throw new HTTPException(403, { message: "Superadmin access required" });
  }
}

// Platform-level organization management (superadmin only). Mounted at /api/admin.
export const adminRoutes = new Hono();

adminRoutes.get("/organizations", async (c) => {
  requireSuperAdmin(c);
  const { rows } = await query(
    `select o.id, o.name, o.created_at, o.disabled,
            (select count(*)::int from public.sales s where s.organization_id = o.id) as user_count
     from public.organizations o
     order by o.id asc`,
  );
  c.header(
    "Content-Range",
    `organizations 0-${Math.max(rows.length - 1, 0)}/${rows.length}`,
  );
  return c.json(rows);
});

adminRoutes.patch("/organizations/:id", async (c) => {
  requireSuperAdmin(c);
  const body = await c.req.json<{ disabled?: boolean }>();
  const { rows } = await query(
    "update public.organizations set disabled = $1 where id = $2 returning id, name, created_at, disabled",
    [body.disabled ?? false, c.req.param("id")],
  );
  if (!rows[0]) {
    throw new HTTPException(404, { message: "Organization not found" });
  }
  return c.json(rows[0]);
});
