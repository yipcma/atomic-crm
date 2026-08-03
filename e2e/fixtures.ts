import { test as base, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

// The e2e stack is the real one: the built SPA on a single origin, with /api
// reverse-proxied to the Hono API, and a throwaway Postgres behind it. Seeding
// goes through the public API rather than straight into tables, so the fixtures
// exercise the same signup/invite paths a user would.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5175";
const API_URL = `${BASE_URL}/api`;

const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgres://crm:crm@localhost:5432/crm";

// Reset shells out to psql rather than using the `pg` driver, because pg is a
// dependency of server/ only and this repo requires a human to vet any new
// root package. Override E2E_PSQL when psql is not on PATH, e.g.
// E2E_PSQL="docker compose exec -T db psql".
const PSQL = (process.env.E2E_PSQL ?? "psql").split(" ");

// CASCADE resolves the dependency graph, so no FK-ordered delete loop is
// needed. RESTART IDENTITY keeps ids predictable between specs.
const TABLES = [
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

function sql(statement: string): string {
  const [cmd, ...prefix] = PSQL;
  const args = process.env.E2E_PSQL
    ? [...prefix, "-v", "ON_ERROR_STOP=1", "-tAc", statement]
    : [...prefix, DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-tAc", statement];
  return execFileSync(cmd, args, { encoding: "utf8" }).trim();
}

async function resetDb() {
  sql(
    `truncate table ${TABLES.map((t) => `public.${t}`).join(", ")} restart identity cascade`,
  );
}

async function api<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...rest } = init;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path} -> ${res.status}: ${text}`,
    );
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export interface SeededOrg {
  orgId: number;
  saleId: number;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
  identity: Record<string, unknown>;
}

// Self-serve signup: creates a NEW organization and its first admin.
async function createOrganization({
  name = "Acme Inc",
  email = "admin@example.test",
  password = "correct horse battery staple",
  first_name = "Ada",
  last_name = "Admin",
}: Partial<{
  name: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}> = {}): Promise<SeededOrg> {
  const signup = await api<{
    access_token: string;
    refresh_token: string;
    identity: { id: number };
  }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      first_name,
      last_name,
      organization_name: name,
    }),
  });

  const orgId = Number(
    sql(
      `select organization_id from public.sales where id = ${Number(signup.identity.id)}`,
    ),
  );

  return {
    orgId,
    saleId: signup.identity.id,
    email,
    password,
    accessToken: signup.access_token,
    refreshToken: signup.refresh_token,
    identity: signup.identity,
  };
}

const createCompany = ({ name, token }: { name: string; token: string }) =>
  api<{ id: number }>("/companies", {
    method: "POST",
    token,
    body: JSON.stringify({ name }),
  });

const createContact = ({
  first_name,
  last_name,
  title = "",
  company_id = null,
  token,
}: {
  first_name: string;
  last_name: string;
  title?: string;
  company_id?: number | null;
  token: string;
}) =>
  api<{ id: number }>("/contacts", {
    method: "POST",
    token,
    body: JSON.stringify({
      first_name,
      last_name,
      title,
      company_id,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      has_newsletter: false,
      tags: [],
      gender: "unknown",
      status: "cold",
      background: "",
      email_jsonb: [],
      phone_jsonb: [],
    }),
  });

const createNotes = async ({
  contactId,
  token,
  notes,
}: {
  contactId: number;
  token: string;
  notes: { text: string; date?: string; status?: "cold" | "warm" | "hot" }[];
}) => {
  for (const { text, date, status = "cold" } of notes) {
    await api("/contact_notes", {
      method: "POST",
      token,
      body: JSON.stringify({
        contact_id: contactId,
        text,
        status,
        date: date ?? new Date().toISOString(),
      }),
    });
  }
};

// Seeds the session directly rather than driving the login form: faster, and it
// keeps specs focused on the behavior under test. Mirrors what
// railway/authProvider.establishSession writes.
async function signIn(page: Page, org: SeededOrg) {
  await page.addInitScript(
    ([access, refresh, identity]) => {
      localStorage.setItem("atomic_crm.access_token", access as string);
      localStorage.setItem("atomic_crm.refresh_token", refresh as string);
      localStorage.setItem("RaStore.auth.current_identity", identity as string);
      localStorage.setItem("RaStore.auth.is_initialized", "true");
    },
    [org.accessToken, org.refreshToken, JSON.stringify(org.identity)] as const,
  );
}

const getMenuMethod = ({ page }: { page: Page; isMobile: boolean }) => ({
  goToDashboard: async () => {
    await page.getByRole("link", { name: "Dashboard" }).click();
    await page.waitForLoadState("networkidle");
  },
  goToContacts: async () => {
    await page.getByRole("link", { name: "Contacts" }).click();
    await page.waitForLoadState("networkidle");
  },
});

const dismissToast = async (page: Page, content: string) => {
  await expect(page.getByText(content)).toBeVisible();
  await page.getByLabel("Close toast").first().click();
  // Optimistic UI: dismissing the toast triggers the linked API request.
  await page.waitForLoadState("networkidle");
};

export const test = base.extend<{
  resetDb: void;
  createOrganization: typeof createOrganization;
  createCompany: typeof createCompany;
  createContact: typeof createContact;
  createNotes: typeof createNotes;
  signIn: (org: SeededOrg) => Promise<void>;
  menu: ReturnType<typeof getMenuMethod>;
  dismissToast: (content: string) => Promise<void>;
}>({
  resetDb: [
    // Playwright statically analyses the destructuring pattern to work out which
    // fixtures a test requests, so `{}` is required here rather than `_`.
    // eslint-disable-next-line no-empty-pattern
    async ({}, cb) => {
      await resetDb();
      await cb();
    },
    { auto: true },
  ],
  // eslint-disable-next-line no-empty-pattern
  createOrganization: async ({}, cb) => {
    await cb(createOrganization);
  },
  // eslint-disable-next-line no-empty-pattern
  createCompany: async ({}, cb) => {
    await cb(createCompany);
  },
  // eslint-disable-next-line no-empty-pattern
  createContact: async ({}, cb) => {
    await cb(createContact);
  },
  // eslint-disable-next-line no-empty-pattern
  createNotes: async ({}, cb) => {
    await cb(createNotes);
  },
  signIn: async ({ page }, cb) => {
    await cb((org: SeededOrg) => signIn(page, org));
  },
  menu: async ({ page, isMobile }, cb) => {
    await cb(getMenuMethod({ page, isMobile }));
  },
  dismissToast: async ({ page }, cb) => {
    await cb((content: string) => dismissToast(page, content));
  },
});

export { expect, api, sql };
