import { HTTPException } from "hono/http-exception";
import { getColumn, hasColumn } from "../columns.js";

// Comparison operators supported in filter keys, matching the PostgREST-style
// suffixes the frontend already emits (e.g. "last_seen@gte", "tags@cs").
const OPERATORS = new Set([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "ilike",
  "in",
  "is",
  "cs",
]);

interface Builder {
  params: unknown[];
}

function placeholder(builder: Builder, value: unknown): string {
  builder.params.push(value);
  return `$${builder.params.length}`;
}

function splitKey(key: string): { column: string; op: string } {
  const idx = key.lastIndexOf("@");
  if (idx > 0) {
    const op = key.slice(idx + 1);
    if (OPERATORS.has(op)) {
      return { column: key.slice(0, idx), op };
    }
  }
  return { column: key, op: "eq" };
}

// Parse a PostgreSQL array literal like "{1,2,3}" into its elements.
function parseArrayLiteral(value: unknown): (string | number)[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value
      .trim()
      .replace(/^\{|\}$/g, "")
      .replace(/^\(|\)$/g, "");
    if (trimmed === "") return [];
    return trimmed.split(",").map((part) => {
      const cleaned = part.trim().replace(/^"|"$/g, "");
      const asNumber = Number(cleaned);
      return Number.isNaN(asNumber) ? cleaned : asNumber;
    });
  }
  return [value as string];
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function buildCondition(
  source: string,
  key: string,
  value: unknown,
  builder: Builder,
): string | null {
  if (key === "@or") {
    if (value == null || typeof value !== "object") return null;
    const parts: string[] = [];
    for (const [subKey, subValue] of Object.entries(value)) {
      const cond = buildCondition(source, subKey, subValue, builder);
      if (cond) parts.push(cond);
    }
    if (parts.length === 0) return null;
    return `(${parts.join(" OR ")})`;
  }

  const { column, op } = splitKey(key);
  if (!hasColumn(source, column)) {
    throw new HTTPException(400, {
      message: `Unknown filter column: ${column}`,
    });
  }
  const meta = getColumn(source, column);
  const col = quoteIdent(column);

  switch (op) {
    case "neq":
      if (value === null) return `${col} IS NOT NULL`;
      return `${col} IS DISTINCT FROM ${placeholder(builder, value)}`;
    case "gt":
      return `${col} > ${placeholder(builder, value)}`;
    case "gte":
      return `${col} >= ${placeholder(builder, value)}`;
    case "lt":
      return `${col} < ${placeholder(builder, value)}`;
    case "lte":
      return `${col} <= ${placeholder(builder, value)}`;
    case "ilike":
      return `${col} ILIKE ${placeholder(builder, `%${value}%`)}`;
    case "in":
      return `${col} = ANY(${placeholder(builder, parseArrayLiteral(value))})`;
    case "is":
      return `${col} IS NULL`;
    case "cs":
      return `${col} @> ${placeholder(builder, parseArrayLiteral(value))}`;
    case "eq":
    default:
      if (value === null) return `${col} IS NULL`;
      if (Array.isArray(value)) {
        return `${col} = ANY(${placeholder(builder, value)})`;
      }
      // Array columns filtered by a scalar id use containment (e.g. contact_ids).
      if (meta?.isArray) {
        return `${col} @> ${placeholder(builder, [value])}`;
      }
      return `${col} = ${placeholder(builder, value)}`;
  }
}

export interface WhereResult {
  clause: string; // includes leading "WHERE " or empty string
  params: unknown[];
}

export function buildWhere(
  source: string,
  filter: Record<string, unknown> | undefined,
): WhereResult {
  const builder: Builder = { params: [] };
  const conditions: string[] = [];

  for (const [key, value] of Object.entries(filter ?? {})) {
    if (value === undefined) continue;
    const cond = buildCondition(source, key, value, builder);
    if (cond) conditions.push(cond);
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params: builder.params,
  };
}

export function buildOrderBy(
  source: string,
  sort: [string, string] | undefined,
): string {
  const field = sort?.[0] && hasColumn(source, sort[0]) ? sort[0] : "id";
  const dir = (sort?.[1] ?? "ASC").toUpperCase() === "DESC" ? "DESC" : "ASC";
  return `ORDER BY ${quoteIdent(field)} ${dir} NULLS LAST`;
}
