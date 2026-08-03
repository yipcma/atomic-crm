import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { app } from "../index.js";
import { assertMigratedTo, closeDb, pool } from "../test/db.js";
import {
  auth,
  post,
  put,
  seedTwoOrgs,
  type OrgFixture,
} from "../test/fixtures.js";
import { RESOURCES } from "./resources.js";

let A: OrgFixture;
let B: OrgFixture;

before(async () => {
  await assertMigratedTo("0006_composite_fks.sql");
  ({ A, B } = await seedTwoOrgs());
});

after(async () => {
  await closeDb();
});

// Resource -> the id in each fixture, for the read/write matrix.
const ID_OF: Record<string, (f: OrgFixture) => number> = {
  companies: (f) => f.company,
  contacts: (f) => f.contact,
  deals: (f) => f.deal,
  tags: (f) => f.tag,
  tasks: (f) => f.task,
  contact_notes: (f) => f.contactNote,
  deal_notes: (f) => f.dealNote,
  sales: (f) => f.admin.saleId,
};

describe("cross-tenant reads", () => {
  it("returns 404 (not 403) for another tenant's record on every resource", async () => {
    for (const [resource, pick] of Object.entries(ID_OF)) {
      const res = await app.request(
        `/api/${resource}/${pick(B)}`,
        auth(A.admin.token),
      );
      // 404 rather than 403 on purpose: a 403 confirms the record exists, which
      // is itself a cross-tenant disclosure.
      assert.equal(
        res.status,
        404,
        `GET /api/${resource}/<org B id> as org A returned ${res.status}`,
      );
    }
  });

  it("lists only the caller's own rows", async () => {
    for (const resource of Object.keys(ID_OF)) {
      const res = await app.request(`/api/${resource}`, auth(A.admin.token));
      assert.equal(res.status, 200);
      const rows = (await res.json()) as Array<{
        id: number;
        organization_id: number;
      }>;

      const foreign = rows.filter((r) => r.organization_id !== A.orgId);
      assert.deepEqual(
        foreign,
        [],
        `/api/${resource} leaked rows from another org`,
      );
    }
  });

  it("does not leak another tenant's rows through activity_log", async () => {
    const res = await app.request("/api/activity_log", auth(A.admin.token));
    assert.equal(res.status, 200);
    const rows = (await res.json()) as Array<{ organization_id: number }>;

    assert.ok(rows.length > 0, "expected org A to have activity");
    assert.ok(rows.every((r) => r.organization_id === A.orgId));
  });
});

describe("the contacts_summary company_name leak", () => {
  // Two INDEPENDENT assertions on purpose. The first proves the write is
  // blocked (migration 0006); the second proves that even if such a row existed,
  // the view no longer exposes it (migration 0005). Testing only one would let a
  // single fix mask the absence of the other.

  it("refuses to create a contact pointing at another tenant's company", async () => {
    const res = await app.request(
      "/api/contacts",
      post(A.admin.token, {
        first_name: "Mallory",
        last_name: "Probe",
        company_id: B.company,
      }),
    );

    // 400, not merely ">= 400": a 500 here would mean the integrity violation
    // is leaking out as an unhandled error instead of a validation failure.
    assert.equal(
      res.status,
      400,
      `cross-tenant company_id should be a client error, got ${res.status}`,
    );
  });

  it("returns a null company_name even when a cross-tenant row exists in the table", async () => {
    // Bypass the API and the foreign key to plant exactly the row an attacker
    // used to be able to create, then read it back through the view.
    await pool.query(
      "alter table public.contacts drop constraint contacts_company_id_fkey",
    );
    let plantedId: number;
    try {
      const { rows } = await pool.query<{ id: number }>(
        `insert into public.contacts (first_name, last_name, organization_id, company_id)
         values ('Planted', 'Row', $1, $2) returning id`,
        [A.orgId, B.company],
      );
      plantedId = rows[0].id;

      const res = await app.request(
        `/api/contacts/${plantedId}`,
        auth(A.admin.token),
      );
      assert.equal(res.status, 200);
      const row = (await res.json()) as { company_name: string | null };

      assert.equal(
        row.company_name,
        null,
        "contacts_summary exposed another tenant's company name",
      );
    } finally {
      await pool.query(
        "delete from public.contacts where first_name = 'Planted'",
      );
      await pool.query(
        `alter table public.contacts add constraint contacts_company_id_fkey
           foreign key (company_id, organization_id)
           references public.companies (id, organization_id)
           on update cascade on delete cascade`,
      );
    }
  });

  it("does not inflate the victim's aggregate counts", async () => {
    const res = await app.request(
      `/api/companies/${B.company}`,
      auth(B.admin.token),
    );
    const row = (await res.json()) as { nb_contacts: number };

    // Org B seeded exactly one contact against its own company.
    assert.equal(row.nb_contacts, 1);
  });
});

describe("cross-tenant writes", () => {
  const SCALAR_CASES: Array<[string, Record<string, unknown>]> = [
    ["contacts", { first_name: "X", last_name: "Y" }],
    ["deals", { name: "X", stage: "opportunity" }],
    ["tasks", { text: "X", type: "None", due_date: "2030-01-01" }],
    ["contact_notes", { text: "X", date: "2030-01-01" }],
    ["deal_notes", { text: "X", date: "2030-01-01" }],
  ];

  it("rejects a foreign parent id on every relational resource", async () => {
    const foreignParent: Record<string, Record<string, number>> = {
      contacts: { company_id: B.company },
      deals: { company_id: B.company },
      tasks: { contact_id: B.contact },
      contact_notes: { contact_id: B.contact },
      deal_notes: { deal_id: B.deal },
    };

    for (const [resource, base] of SCALAR_CASES) {
      const res = await app.request(
        `/api/${resource}`,
        post(A.admin.token, { ...base, ...foreignParent[resource] }),
      );
      assert.equal(
        res.status,
        400,
        `${resource} should reject a cross-tenant parent with 400, got ${res.status}`,
      );
    }
  });

  it("rejects foreign ids inside array columns", async () => {
    // Postgres has no per-element foreign key, so these are checked in crud.ts.
    const cases: Array<[string, Record<string, unknown>]> = [
      ["contacts", { first_name: "T", last_name: "T", tags: [B.tag] }],
      ["deals", { name: "T", stage: "opportunity", contact_ids: [B.contact] }],
      [
        "tasks",
        {
          contact_id: A.contact,
          text: "T",
          type: "None",
          due_date: "2030-01-01",
          mentions: [B.admin.saleId],
        },
      ],
    ];

    for (const [resource, body] of cases) {
      const res = await app.request(
        `/api/${resource}`,
        post(A.admin.token, body),
      );
      assert.equal(
        res.status,
        400,
        `${resource} should reject a cross-tenant array ref with 400, got ${res.status}`,
      );
    }
  });

  it("accepts the same shapes when the references are same-tenant", async () => {
    // The guard must not be so blunt that it breaks legitimate writes.
    const res = await app.request(
      "/api/contacts",
      post(A.admin.token, {
        first_name: "Legit",
        last_name: "Contact",
        company_id: A.company,
        tags: [A.tag],
      }),
    );
    assert.equal(res.status, 201, await res.text());
  });

  it("ignores a client-supplied organization_id on create and update", async () => {
    const created = await app.request(
      "/api/companies",
      post(A.admin.token, { name: "Pinned", organization_id: B.orgId }),
    );
    const row = (await created.json()) as {
      id: number;
      organization_id: number;
    };
    assert.equal(row.organization_id, A.orgId);

    await app.request(
      `/api/companies/${row.id}`,
      put(A.admin.token, { name: "Pinned", organization_id: B.orgId }),
    );
    const { rows } = await pool.query<{ organization_id: number }>(
      "select organization_id from public.companies where id = $1",
      [row.id],
    );
    assert.equal(rows[0].organization_id, A.orgId);
  });

  it("cannot update or delete another tenant's record", async () => {
    const before = await pool.query<{ name: string }>(
      "select name from public.companies where id = $1",
      [B.company],
    );

    const updated = await app.request(
      `/api/companies/${B.company}`,
      put(A.admin.token, { name: "Hijacked" }),
    );
    assert.equal(updated.status, 404);

    const deleted = await app.request(
      `/api/companies/${B.company}`,
      auth(A.admin.token, { method: "DELETE" }),
    );
    assert.equal(deleted.status, 404);

    const after = await pool.query<{ name: string }>(
      "select name from public.companies where id = $1",
      [B.company],
    );
    assert.equal(after.rows[0].name, before.rows[0].name);
  });
});

describe("cascade blast radius", () => {
  it("deleting a company in one tenant leaves the other tenant intact", async () => {
    const countB = async () => {
      const { rows } = await pool.query<{ count: number }>(
        `select (select count(*) from public.contacts where organization_id = $1)
              + (select count(*) from public.deals    where organization_id = $1)
              + (select count(*) from public.tasks    where organization_id = $1) as count`,
        [B.orgId],
      );
      return Number(rows[0].count);
    };
    const before = await countB();

    const res = await app.request(
      `/api/companies/${A.company}`,
      auth(A.admin.token, { method: "DELETE" }),
    );
    assert.ok(res.status < 400, await res.text());

    assert.equal(
      await countB(),
      before,
      "a delete in org A destroyed org B data",
    );
  });
});

describe("filter and sort cannot escape the tenant", () => {
  it("an organization_id filter naming another tenant returns nothing", async () => {
    const filter = encodeURIComponent(
      JSON.stringify({ organization_id: B.orgId }),
    );
    const res = await app.request(
      `/api/contacts?filter=${filter}`,
      auth(A.admin.token),
    );

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), []);
  });

  it("a hostile sort field does not execute as SQL", async () => {
    const sort = encodeURIComponent(
      JSON.stringify(["organization_id; drop table contacts", "ASC"]),
    );
    const res = await app.request(
      `/api/contacts?sort=${sort}`,
      auth(A.admin.token),
    );

    assert.equal(res.status, 200);
    const { rows } = await pool.query<{ count: number }>(
      "select count(*)::int as count from information_schema.tables where table_name = 'contacts'",
    );
    assert.equal(rows[0].count, 1, "contacts table should still exist");
  });
});

describe("authorization", () => {
  it("a non-admin member cannot overwrite the organization config", async () => {
    const before = await pool.query<{ config: unknown }>(
      "select config from public.organizations where id = $1",
      [A.orgId],
    );

    const res = await app.request(
      "/api/configuration/1",
      put(A.member.token, { config: { title: "Hijacked" } }),
    );
    assert.equal(res.status, 403);

    const after = await pool.query<{ config: unknown }>(
      "select config from public.organizations where id = $1",
      [A.orgId],
    );
    assert.deepEqual(after.rows[0].config, before.rows[0].config);
  });

  it("an admin can update its own organization config, and only its own", async () => {
    const res = await app.request(
      "/api/configuration/1",
      put(A.admin.token, { config: { title: "Alpha CRM" } }),
    );
    assert.equal(res.status, 200);

    const { rows } = await pool.query<{ config: { title?: string } }>(
      "select config from public.organizations where id = $1",
      [B.orgId],
    );
    assert.notEqual(rows[0].config?.title, "Alpha CRM");
  });

  it("a non-superadmin cannot reach the platform admin routes", async () => {
    const res = await app.request(
      "/api/admin/organizations",
      auth(A.admin.token),
    );
    assert.equal(res.status, 403);
  });

  it("rejects requests with no or invalid credentials", async () => {
    assert.equal((await app.request("/api/contacts")).status, 401);
    assert.equal(
      (await app.request("/api/contacts", auth("not-a-token"))).status,
      401,
    );
  });
});

describe("every exposed resource is covered by this suite", () => {
  it("has an id mapping for each entry in RESOURCES", () => {
    // Forces a new resource to be added to the matrix above rather than
    // silently shipping untested.
    const covered = new Set([...Object.keys(ID_OF), "activity_log"]);
    const uncovered = Object.keys(RESOURCES).filter((r) => !covered.has(r));

    assert.deepEqual(uncovered, [], "these resources have no tenancy test");
  });
});
