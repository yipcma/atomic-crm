import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  updateRecord,
  type ResourceHooks,
  type WriteContext,
} from "../rest/crud.js";
import { query } from "../db.js";
import { requireAdmin } from "../auth/middleware.js";
import { deleteFiles } from "../storage.js";
import {
  enrichCompanyLogo,
  enrichContactAvatar,
  lowercaseEmails,
} from "../behaviors.js";

function parseJsonParam<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new HTTPException(400, { message: "Invalid query parameter" });
  }
}

function attachmentPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      item && typeof item === "object" ? (item as any).path : null,
    )
    .filter((path): path is string => typeof path === "string" && path !== "");
}

async function cleanupAttachments(
  previous: Record<string, unknown>,
  next: Record<string, unknown> | null,
): Promise<void> {
  const previousPaths = attachmentPaths(previous.attachments);
  const nextPaths = new Set(attachmentPaths(next?.attachments));
  const removed = previousPaths.filter((path) => !nextPaths.has(path));
  await deleteFiles(removed);
}

async function bumpContactLastSeen(
  row: Record<string, unknown>,
): Promise<void> {
  if (row.contact_id == null || row.date == null) return;
  await query(
    `update public.contacts set last_seen = $1
     where id = $2 and organization_id = $3 and (last_seen is null or last_seen < $1)`,
    [row.date, row.contact_id, row.organization_id],
  );
}

function writeContext(c: any): WriteContext {
  const sale = c.get("sale");
  return { saleId: sale.id, organizationId: sale.organization_id };
}

const HOOKS: Record<string, ResourceHooks> = {
  contacts: {
    beforeCreate: async (data) => {
      lowercaseEmails(data);
      await enrichContactAvatar(data);
      return data;
    },
    beforeUpdate: async (_id, data) => {
      lowercaseEmails(data);
      await enrichContactAvatar(data);
      return data;
    },
  },
  companies: {
    beforeCreate: async (data) => {
      await enrichCompanyLogo(data);
      return data;
    },
    beforeUpdate: async (_id, data) => {
      await enrichCompanyLogo(data);
      return data;
    },
  },
  contact_notes: {
    afterCreate: async (row) => {
      await bumpContactLastSeen(row);
    },
    afterUpdate: async (row, previous) => {
      await cleanupAttachments(previous, row);
    },
    beforeDelete: async (row) => {
      await cleanupAttachments(row, null);
    },
  },
  deal_notes: {
    afterUpdate: async (row, previous) => {
      await cleanupAttachments(previous, row);
    },
    beforeDelete: async (row) => {
      await cleanupAttachments(row, null);
    },
  },
};

// Resources whose writes are only allowed through dedicated routes.
const READ_ONLY = new Set(["activity_log", "sales"]);
const NO_CREATE_DELETE = new Set<string>();

function assertWritable(resource: string): void {
  if (READ_ONLY.has(resource)) {
    throw new HTTPException(405, {
      message: `Resource ${resource} is read-only on this endpoint`,
    });
  }
}

export const dataRoutes = new Hono();

// Per-organization configuration (stored on organizations.config). Registered
// before the generic /:resource routes so it is not treated as a table. The id
// is ignored; the caller's organization determines the row.
dataRoutes.get("/configuration/:id", async (c) => {
  const orgId = c.get("sale").organization_id;
  const { rows } = await query<{ config: unknown }>(
    "select config from public.organizations where id = $1",
    [orgId],
  );
  return c.json({ id: 1, config: rows[0]?.config ?? {} });
});

dataRoutes.put("/configuration/:id", async (c) => {
  // Org-wide settings (branding, deal stages, task types): admins only.
  requireAdmin(c);
  const orgId = c.get("sale").organization_id;
  const body = await c.req.json<{ config?: unknown }>();
  const { rows } = await query<{ config: unknown }>(
    "update public.organizations set config = $1 where id = $2 returning config",
    [body.config ?? {}, orgId],
  );
  return c.json({ id: 1, config: rows[0]?.config ?? {} });
});

dataRoutes.get("/:resource", async (c) => {
  const resource = c.req.param("resource");
  const filter = parseJsonParam<Record<string, unknown>>(
    c.req.query("filter"),
    {},
  );
  const sort = parseJsonParam<[string, string] | undefined>(
    c.req.query("sort"),
    undefined,
  );
  const range = parseJsonParam<[number, number] | undefined>(
    c.req.query("range"),
    undefined,
  );

  const result = await listRecords(
    resource,
    { filter, sort, range },
    c.get("sale").organization_id,
  );
  const rangeEnd = Math.max(result.start, result.end);
  c.header(
    "Content-Range",
    `${resource} ${result.start}-${rangeEnd}/${result.total}`,
  );
  return c.json(result.rows);
});

dataRoutes.get("/:resource/:id", async (c) => {
  const row = await getRecord(
    c.req.param("resource"),
    c.req.param("id"),
    c.get("sale").organization_id,
  );
  return c.json(row);
});

dataRoutes.post("/:resource", async (c) => {
  const resource = c.req.param("resource");
  assertWritable(resource);
  if (NO_CREATE_DELETE.has(resource)) {
    throw new HTTPException(405, { message: "Create not allowed" });
  }
  const ctx: WriteContext = writeContext(c);
  const body = await c.req.json();
  const row = await createRecord(resource, body, ctx, HOOKS[resource]);
  return c.json(row, 201);
});

dataRoutes.put("/:resource/:id", async (c) => {
  const resource = c.req.param("resource");
  assertWritable(resource);
  const ctx: WriteContext = writeContext(c);
  const body = await c.req.json();
  const row = await updateRecord(
    resource,
    c.req.param("id"),
    body,
    ctx,
    HOOKS[resource],
  );
  return c.json(row);
});

dataRoutes.delete("/:resource/:id", async (c) => {
  const resource = c.req.param("resource");
  assertWritable(resource);
  if (NO_CREATE_DELETE.has(resource)) {
    throw new HTTPException(405, { message: "Delete not allowed" });
  }
  const ctx: WriteContext = writeContext(c);
  const row = await deleteRecord(
    resource,
    c.req.param("id"),
    ctx,
    HOOKS[resource],
  );
  return c.json(row);
});
