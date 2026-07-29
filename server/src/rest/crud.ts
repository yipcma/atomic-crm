import { HTTPException } from "hono/http-exception";
import { query, withTransaction, type PoolClient } from "../db.js";
import { getColumn, getColumns } from "../columns.js";
import { buildOrderBy, buildWhere } from "./filter.js";
import { getResource } from "./resources.js";

export interface WriteContext {
  saleId: number;
}

export interface ResourceHooks {
  beforeCreate?(
    data: Record<string, unknown>,
    ctx: WriteContext,
  ): Promise<Record<string, unknown>> | Record<string, unknown>;
  beforeUpdate?(
    id: string,
    data: Record<string, unknown>,
    previous: Record<string, unknown>,
    ctx: WriteContext,
  ): Promise<Record<string, unknown>> | Record<string, unknown>;
  afterCreate?(row: Record<string, unknown>, ctx: WriteContext): Promise<void>;
  afterUpdate?(
    row: Record<string, unknown>,
    previous: Record<string, unknown>,
    ctx: WriteContext,
  ): Promise<void>;
  beforeDelete?(row: Record<string, unknown>, ctx: WriteContext): Promise<void>;
}

function resourceOrThrow(resource: string) {
  const def = getResource(resource);
  if (!def) {
    throw new HTTPException(404, { message: `Unknown resource: ${resource}` });
  }
  return def;
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

// Serialize a value for its column type. node-pg maps JS arrays to SQL arrays
// and JS objects to JSON, so scalar json(b) columns fed an array/object must be
// stringified, and json(b)[] columns need each element stringified + a cast.
function encodeColumn(
  table: string,
  key: string,
  raw: unknown,
  index: number,
): { placeholder: string; value: unknown } {
  const meta = getColumn(table, key);
  if (raw === null || raw === undefined) {
    return { placeholder: `$${index}`, value: null };
  }
  if (meta?.isJsonArray) {
    const arr = Array.isArray(raw) ? raw : [raw];
    return {
      placeholder: `$${index}::jsonb[]`,
      value: arr.map((entry) => JSON.stringify(entry)),
    };
  }
  if (meta?.isJson) {
    return {
      placeholder: `$${index}::${meta.udtName}`,
      value: JSON.stringify(raw),
    };
  }
  if (meta?.isBigintArray) {
    return {
      placeholder: `$${index}::bigint[]`,
      value: Array.isArray(raw) ? raw : [raw],
    };
  }
  return { placeholder: `$${index}`, value: raw };
}

// Keep only keys that are real columns of the write table.
function pickWritable(
  table: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const columns = getColumns(table);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (columns.has(key)) result[key] = value;
  }
  return result;
}

export interface ListQuery {
  filter?: Record<string, unknown>;
  sort?: [string, string];
  range?: [number, number];
}

export interface ListResult {
  rows: Record<string, unknown>[];
  total: number;
  start: number;
  end: number;
}

export async function listRecords(
  resource: string,
  { filter, sort, range }: ListQuery,
): Promise<ListResult> {
  const { readSource } = resourceOrThrow(resource);
  const where = buildWhere(readSource, filter);
  const orderBy = buildOrderBy(readSource, sort);

  const start = range?.[0] ?? 0;
  const end = range?.[1] ?? start + 24;
  const limit = Math.max(0, end - start + 1);

  const countResult = await query<{ count: number }>(
    `select count(*)::int as count from ${quoteIdent(readSource)} ${where.clause}`,
    where.params,
  );
  const total = countResult.rows[0]?.count ?? 0;

  const dataResult = await query(
    `select * from ${quoteIdent(readSource)} ${where.clause} ${orderBy} limit ${limit} offset ${start}`,
    where.params,
  );

  return {
    rows: dataResult.rows,
    total,
    start,
    end: start + dataResult.rows.length - 1,
  };
}

export async function getRecord(
  resource: string,
  id: string,
): Promise<Record<string, unknown>> {
  const { readSource } = resourceOrThrow(resource);
  const { rows } = await query(
    `select * from ${quoteIdent(readSource)} where id = $1`,
    [id],
  );
  if (!rows[0]) {
    throw new HTTPException(404, { message: "Record not found" });
  }
  return rows[0];
}

async function reload(
  client: PoolClient | null,
  readSource: string,
  id: unknown,
): Promise<Record<string, unknown>> {
  const sql = `select * from ${quoteIdent(readSource)} where id = $1`;
  const result = client
    ? await client.query(sql, [id])
    : await query(sql, [id]);
  return result.rows[0];
}

export async function createRecord(
  resource: string,
  input: Record<string, unknown>,
  ctx: WriteContext,
  hooks: ResourceHooks = {},
): Promise<Record<string, unknown>> {
  const { table, readSource } = resourceOrThrow(resource);

  let data = { ...input };
  // Default sales_id to the current user when the table tracks ownership.
  if (getColumns(table).has("sales_id") && data.sales_id == null) {
    data.sales_id = ctx.saleId;
  }
  if (hooks.beforeCreate) data = await hooks.beforeCreate(data, ctx);

  const writable = pickWritable(table, data);
  const keys = Object.keys(writable);
  if (keys.length === 0) {
    throw new HTTPException(400, { message: "No writable fields provided" });
  }
  const cols = keys.map(quoteIdent).join(", ");
  const placeholders: string[] = [];
  const values: unknown[] = [];
  keys.forEach((key) => {
    const encoded = encodeColumn(table, key, writable[key], values.length + 1);
    placeholders.push(encoded.placeholder);
    values.push(encoded.value);
  });

  return withTransaction(async (client) => {
    const inserted = await client.query(
      `insert into ${quoteIdent(table)} (${cols}) values (${placeholders.join(", ")}) returning id`,
      values,
    );
    const id = inserted.rows[0]?.id;
    const row = await reload(client, readSource, id);
    if (hooks.afterCreate) await hooks.afterCreate(row, ctx);
    return row;
  });
}

export async function updateRecord(
  resource: string,
  id: string,
  input: Record<string, unknown>,
  ctx: WriteContext,
  hooks: ResourceHooks = {},
): Promise<Record<string, unknown>> {
  const { table, readSource } = resourceOrThrow(resource);

  const previous = await getRecord(resource, id);
  let data = { ...input };
  if (hooks.beforeUpdate) {
    data = await hooks.beforeUpdate(id, data, previous, ctx);
  }

  const writable = pickWritable(table, data);
  delete writable.id;
  const keys = Object.keys(writable);

  return withTransaction(async (client) => {
    if (keys.length > 0) {
      const assignments: string[] = [];
      const values: unknown[] = [];
      keys.forEach((key) => {
        const encoded = encodeColumn(
          table,
          key,
          writable[key],
          values.length + 1,
        );
        assignments.push(`${quoteIdent(key)} = ${encoded.placeholder}`);
        values.push(encoded.value);
      });
      values.push(id);
      await client.query(
        `update ${quoteIdent(table)} set ${assignments.join(", ")} where id = $${values.length}`,
        values,
      );
    }
    const row = await reload(client, readSource, id);
    if (hooks.afterUpdate) await hooks.afterUpdate(row, previous, ctx);
    return row;
  });
}

export async function deleteRecord(
  resource: string,
  id: string,
  ctx: WriteContext,
  hooks: ResourceHooks = {},
): Promise<Record<string, unknown>> {
  const { table } = resourceOrThrow(resource);
  const previous = await getRecord(resource, id);
  if (hooks.beforeDelete) await hooks.beforeDelete(previous, ctx);
  await query(`delete from ${quoteIdent(table)} where id = $1`, [id]);
  return previous;
}
