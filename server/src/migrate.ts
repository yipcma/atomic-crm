import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "./db.js";

// Resolve the migrations directory relative to this file so it works both from
// src (tsx) and from the compiled dist/ (Docker), where migrations/ sits at ../.
const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations",
);

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      create table if not exists public._migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const applied = new Set(
      (
        await client.query<{ name: string }>(
          "select name from public._migrations",
        )
      ).rows.map((row) => row.name),
    );

    const files = (await readdir(migrationsDir))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(join(migrationsDir, file), "utf8");
      console.log(`Applying migration ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "insert into public._migrations (name) values ($1)",
          [file],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    console.log("Migrations up to date");
  } finally {
    client.release();
  }
}

run()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
