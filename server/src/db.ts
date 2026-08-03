import pg from "pg";
import { env } from "./env.js";

// Return bigint (int8) as JS numbers; CRM ids stay well within Number range.
pg.types.setTypeParser(20, (value) => (value === null ? null : Number(value)));
// Keep DATE columns as plain 'YYYY-MM-DD' strings (avoid timezone drift).
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({ connectionString: env.databaseUrl });

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as any[]);
}

export type PoolClient = pg.PoolClient;

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
