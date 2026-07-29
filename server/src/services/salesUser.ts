import { randomBytes } from "node:crypto";
import { HTTPException } from "hono/http-exception";
import { query, withTransaction } from "../db.js";
import { hashPassword } from "../auth/password.js";

export interface SaleRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  administrator: boolean;
  disabled: boolean;
  avatar: unknown;
  user_id: string;
}

export function generatePassword(): string {
  return randomBytes(12).toString("base64url");
}

export async function countUsers(): Promise<number> {
  const { rows } = await query<{ count: number }>(
    "select count(*)::int as count from public.users",
  );
  return rows[0]?.count ?? 0;
}

export interface CreateSalesInput {
  email: string;
  first_name: string;
  last_name: string;
  administrator: boolean;
  disabled?: boolean;
  avatar?: unknown;
  password?: string;
}

export async function createSalesUser(
  input: CreateSalesInput,
): Promise<{ sale: SaleRow; temporaryPassword?: string }> {
  const password = input.password || generatePassword();
  const encrypted = await hashPassword(password);

  const sale = await withTransaction(async (client) => {
    const existing = await client.query(
      "select 1 from public.users where email = $1",
      [input.email],
    );
    if (existing.rowCount) {
      throw new HTTPException(409, { message: "Email already in use" });
    }
    const user = await client.query<{ id: string }>(
      "insert into public.users (email, encrypted_password) values ($1, $2) returning id",
      [input.email, encrypted],
    );
    const userId = user.rows[0].id;
    const created = await client.query<SaleRow>(
      `insert into public.sales
        (first_name, last_name, email, user_id, administrator, disabled, avatar)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning *`,
      [
        input.first_name,
        input.last_name,
        input.email,
        userId,
        input.administrator,
        input.disabled ?? false,
        input.avatar ?? null,
      ],
    );
    return created.rows[0];
  });

  return {
    sale,
    temporaryPassword: input.password ? undefined : password,
  };
}

export interface UpdateSalesInput {
  email?: string;
  first_name?: string;
  last_name?: string;
  administrator?: boolean;
  disabled?: boolean;
  avatar?: unknown;
}

const UPDATABLE_SALE_FIELDS = [
  "email",
  "first_name",
  "last_name",
  "administrator",
  "disabled",
  "avatar",
] as const;

export async function updateSalesUser(
  saleId: string,
  patch: UpdateSalesInput,
): Promise<SaleRow> {
  return withTransaction(async (client) => {
    const current = await client.query<SaleRow>(
      "select * from public.sales where id = $1",
      [saleId],
    );
    const sale = current.rows[0];
    if (!sale) {
      throw new HTTPException(404, { message: "User not found" });
    }

    if (patch.email && patch.email !== sale.email) {
      await client.query("update public.users set email = $1 where id = $2", [
        patch.email,
        sale.user_id,
      ]);
    }

    const assignments: string[] = [];
    const values: unknown[] = [];
    for (const field of UPDATABLE_SALE_FIELDS) {
      if (patch[field] !== undefined) {
        values.push(patch[field]);
        assignments.push(`${field} = $${values.length}`);
      }
    }
    if (assignments.length > 0) {
      values.push(saleId);
      await client.query(
        `update public.sales set ${assignments.join(", ")} where id = $${values.length}`,
        values,
      );
    }

    const updated = await client.query<SaleRow>(
      "select * from public.sales where id = $1",
      [saleId],
    );
    return updated.rows[0];
  });
}

export async function resetSalesPassword(saleId: string): Promise<string> {
  const password = generatePassword();
  const encrypted = await hashPassword(password);
  const { rows } = await query<{ user_id: string }>(
    "select user_id from public.sales where id = $1",
    [saleId],
  );
  if (!rows[0]) {
    throw new HTTPException(404, { message: "User not found" });
  }
  await query("update public.users set encrypted_password = $1 where id = $2", [
    encrypted,
    rows[0].user_id,
  ]);
  return password;
}
