import { Pool } from "pg";

// Tests run against a REAL Postgres, never a mock. Every bug this suite exists
// to catch (the summary-view join leak, cross-tenant foreign keys, the org
// predicate in crud.ts) is a SQL or schema bug that a mocked driver would
// happily report as passing.
const connectionString =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Set TEST_DATABASE_URL (or DATABASE_URL) to a throwaway Postgres before running the server tests.",
  );
}

export const pool = new Pool({ connectionString, max: 4 });

// Tables in no particular order: CASCADE handles the dependency graph, and
// RESTART IDENTITY keeps ids small and predictable across test files.
const TENANT_TABLES = [
  "contact_notes",
  "deal_notes",
  "tasks",
  "deals",
  "contacts",
  "companies",
  "tags",
  "sales",
  "organizations",
  "users",
];

export async function resetDb(): Promise<void> {
  await pool.query(
    `truncate table ${TENANT_TABLES.map((t) => `public.${t}`).join(", ")} restart identity cascade`,
  );
}

export async function closeDb(): Promise<void> {
  await pool.end();
}

// Guards against a suite silently passing because the schema is older than the
// assertions it makes.
export async function assertMigratedTo(migration: string): Promise<void> {
  const { rows } = await pool.query<{ count: number }>(
    "select count(*)::int as count from public._migrations where name = $1",
    [migration],
  );
  if ((rows[0]?.count ?? 0) === 0) {
    throw new Error(
      `Migration ${migration} has not been applied to the test database. Run \`npm run migrate\` first.`,
    );
  }
}
