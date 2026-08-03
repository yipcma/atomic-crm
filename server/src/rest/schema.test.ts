import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertMigratedTo, closeDb, pool } from "../test/db.js";
import { RESOURCES } from "./resources.js";

// These are the highest-value tests in the suite. They do not test behavior --
// they test the INVARIANTS the behavior depends on, so that adding resource #10
// or revising a view cannot silently reopen the cross-tenant leak eighteen
// months from now. If one of these fails, something structural has regressed.

const TENANT_TABLES = [
  "companies",
  "contacts",
  "deals",
  "contact_notes",
  "deal_notes",
  "tasks",
  "tags",
  "sales",
];

const SUMMARY_VIEWS = ["contacts_summary", "companies_summary", "activity_log"];

before(async () => {
  await assertMigratedTo("0006_composite_fks.sql");
});

after(async () => {
  await closeDb();
});

describe("schema invariants", () => {
  it("every exposed resource carries organization_id on both its table and read source", async () => {
    const { rows } = await pool.query<{
      table_name: string;
      column_name: string;
    }>(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public' and column_name = 'organization_id'`,
    );
    const scoped = new Set(rows.map((r) => r.table_name));

    for (const [name, def] of Object.entries(RESOURCES)) {
      for (const source of new Set([def.table, def.readSource])) {
        assert.ok(
          scoped.has(source),
          `resource "${name}" reads/writes "${source}", which has no organization_id — ` +
            `crud.ts would then serve every tenant's rows`,
        );
      }
    }
  });

  it("every tenant table has organization_id NOT NULL", async () => {
    const { rows } = await pool.query<{
      table_name: string;
      is_nullable: string;
    }>(
      `select table_name, is_nullable from information_schema.columns
        where table_schema = 'public' and column_name = 'organization_id'
          and table_name = any($1)`,
      [TENANT_TABLES],
    );

    assert.equal(rows.length, TENANT_TABLES.length);
    for (const row of rows) {
      assert.equal(
        row.is_nullable,
        "NO",
        `${row.table_name}.organization_id must be NOT NULL, or rows can escape tenant scoping`,
      );
    }
  });

  it("every cross-table foreign key is composite on organization_id", async () => {
    // A single-column FK lets a row in org A point at a parent in org B, which
    // is what made the contacts_summary leak reachable and let a delete in one
    // tenant cascade into another.
    const { rows } = await pool.query<{
      child: string;
      conname: string;
      def: string;
    }>(
      `select conrelid::regclass::text as child, conname,
              pg_get_constraintdef(oid) as def
         from pg_constraint
        where contype = 'f'
          and connamespace = 'public'::regnamespace
          and conrelid::regclass::text = any($1)
          -- The organizations FK is the tenant anchor itself, and a parent with
          -- no organization_id (public.users, the auth identity) cannot be
          -- tenant-scoped -- neither can or should be composite.
          and confrelid::regclass::text <> 'organizations'
          and exists (
                select 1 from information_schema.columns pcol
                 where pcol.table_schema = 'public'
                   and pcol.table_name = confrelid::regclass::text
                   and pcol.column_name = 'organization_id'
              )
          -- The violation: a FK to a tenant-scoped parent that does not carry
          -- organization_id, so a child in org A can point at a parent in org B.
          and not exists (
                select 1 from unnest(conkey) k
                join information_schema.columns col
                  on col.table_name = conrelid::regclass::text
                 and col.ordinal_position = k
                where col.column_name = 'organization_id'
              )`,
      [TENANT_TABLES],
    );

    assert.deepEqual(
      rows.map((r) => `${r.child}.${r.conname}: ${r.def}`),
      [],
      "these foreign keys are not tenant-scoped",
    );
  });

  it("every join in the summary views carries an organization_id predicate", async () => {
    for (const view of SUMMARY_VIEWS) {
      const { rows } = await pool.query<{ def: string }>(
        "select pg_get_viewdef($1::regclass, true) as def",
        [`public.${view}`],
      );
      const def = rows[0].def;

      // Split on JOIN boundaries and check each resulting ON clause. A join
      // without an org predicate is exactly the contacts_summary bug.
      const joins = def.split(/\bJOIN\b/i).slice(1);
      for (const [index, clause] of joins.entries()) {
        const onClause = clause.split(/\bJOIN\b|\bGROUP BY\b|\bUNION\b/i)[0];
        assert.match(
          onClause,
          /organization_id/,
          `${view}: join #${index + 1} has no organization_id predicate in its ON clause — ` +
            `this leaks the joined tenant's data`,
        );
      }
    }
  });

  it("the summary views are security_invoker, so they respect RLS if it is ever enabled", async () => {
    const { rows } = await pool.query<{
      relname: string;
      reloptions: string[] | null;
    }>("select relname, reloptions from pg_class where relname = any($1)", [
      SUMMARY_VIEWS,
    ]);

    assert.equal(rows.length, SUMMARY_VIEWS.length);
    for (const row of rows) {
      assert.ok(
        (row.reloptions ?? []).includes("security_invoker=true"),
        `${row.relname} must be security_invoker, or it would bypass row-level security`,
      );
    }
  });
});
