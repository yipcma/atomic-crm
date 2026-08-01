import { app, initialize } from "../index.js";
import { pool, resetDb } from "./db.js";

export interface Actor {
  saleId: number;
  email: string;
  token: string;
}

export interface OrgFixture {
  orgId: number;
  admin: Actor;
  member: Actor;
  company: number;
  contact: number;
  deal: number;
  tag: number;
  task: number;
  contactNote: number;
  dealNote: number;
}

export function auth(token: string, init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
}

export function post(token: string, body: unknown): RequestInit {
  return auth(token, { method: "POST", body: JSON.stringify(body) });
}

export function put(token: string, body: unknown): RequestInit {
  return auth(token, { method: "PUT", body: JSON.stringify(body) });
}

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON, got ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function createRecord(
  token: string,
  resource: string,
  body: unknown,
): Promise<number> {
  const res = await app.request(`/api/${resource}`, post(token, body));
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(
      `seeding ${resource} failed (${res.status}): ${await res.text()}`,
    );
  }
  const row = await json<{ id: number }>(res);
  return row.id;
}

// Builds one fully-populated tenant THROUGH THE PUBLIC API, so the fixture
// itself exercises the real signup / invite / create paths rather than
// inserting rows behind them.
async function seedOrg(slug: string): Promise<OrgFixture> {
  const adminEmail = `admin-${slug}@example.test`;
  const signup = await app.request(
    "/api/auth/signup",
    post("", {
      email: adminEmail,
      password: "correct horse battery staple",
      first_name: "Ada",
      last_name: slug,
      organization_name: `Org ${slug}`,
    }),
  );
  if (signup.status !== 201) {
    throw new Error(`signup failed (${signup.status}): ${await signup.text()}`);
  }
  const { access_token: adminToken, identity } = await json<{
    access_token: string;
    identity: { id: number };
  }>(signup);

  const { rows } = await pool.query<{ organization_id: number }>(
    "select organization_id from public.sales where id = $1",
    [identity.id],
  );
  const orgId = rows[0].organization_id;

  // A second, NON-admin account in the same org, via the real invite flow.
  const invite = await app.request(
    "/api/users/generic-invite",
    post(adminToken, {}),
  );
  if (invite.status !== 200) {
    throw new Error(`invite failed (${invite.status}): ${await invite.text()}`);
  }
  const { invite_token: signupInvite } = await json<{ invite_token: string }>(
    invite,
  );

  const memberEmail = `member-${slug}@example.test`;
  const register = await app.request(
    "/api/auth/register",
    post("", {
      token: signupInvite,
      email: memberEmail,
      password: "correct horse battery staple",
      first_name: "Grace",
      last_name: slug,
    }),
  );
  if (register.status !== 201) {
    throw new Error(
      `register failed (${register.status}): ${await register.text()}`,
    );
  }
  const memberAuth = await json<{
    access_token: string;
    identity: { id: number };
  }>(register);

  // One of every resource, identical in shape across both orgs so that id
  // collisions between tenants are the DEFAULT case -- which is precisely what
  // makes a scoping bug reachable.
  const company = await createRecord(adminToken, "companies", {
    name: `${slug} Holdings`,
  });
  const contact = await createRecord(adminToken, "contacts", {
    first_name: "Contact",
    last_name: slug,
    company_id: company,
  });
  const deal = await createRecord(adminToken, "deals", {
    name: `${slug} Deal`,
    company_id: company,
    stage: "opportunity",
  });
  const tag = await createRecord(adminToken, "tags", {
    name: `${slug}-tag`,
    color: "#aabbcc",
  });
  const task = await createRecord(adminToken, "tasks", {
    contact_id: contact,
    text: `${slug} task`,
    type: "None",
    due_date: "2030-01-01",
  });
  const contactNote = await createRecord(adminToken, "contact_notes", {
    contact_id: contact,
    text: `${slug} note`,
    date: "2030-01-01",
  });
  const dealNote = await createRecord(adminToken, "deal_notes", {
    deal_id: deal,
    text: `${slug} deal note`,
    date: "2030-01-01",
  });

  return {
    orgId,
    admin: { saleId: identity.id, email: adminEmail, token: adminToken },
    member: {
      saleId: memberAuth.identity.id,
      email: memberEmail,
      token: memberAuth.access_token,
    },
    company,
    contact,
    deal,
    tag,
    task,
    contactNote,
    dealNote,
  };
}

export async function seedTwoOrgs(): Promise<{ A: OrgFixture; B: OrgFixture }> {
  await resetDb();
  await initialize();
  // Sequential: both orgs deliberately reuse the same id sequence positions.
  const A = await seedOrg("alpha");
  const B = await seedOrg("bravo");
  return { A, B };
}
