# Deploying Atomic CRM on Railway

This app runs entirely on Railway with **no Supabase**. Three services plus a
volume:

| Service | Source | Role |
| --- | --- | --- |
| `web` | repo root `Dockerfile` (Caddy) | Serves the built SPA and reverse-proxies `/api/*` + `/storage/*` to the API over private networking (single origin, no CORS) |
| `api` | `server/` `Dockerfile` (Node/Hono) | REST data API, JWT auth, file storage, background enrichment |
| `Postgres` | Railway Postgres plugin | Database |
| Volume | attached to `api` | Attachment files at `/data/attachments` |

## 1. Create the Postgres database

Add a **Postgres** service to your Railway project (`+ New → Database → Postgres`).
It exposes `DATABASE_URL` for reference by other services.

## 2. Create the API service (`api`)

- New service from this repo. Set **Root Directory** to `/server`.
  Railway detects `server/Dockerfile` and `server/railway.json` (which runs
  migrations via the pre-deploy command and health-checks `/health`).
- Attach a **Volume** mounted at `/data/attachments`.
- Variables:

  | Variable | Value |
  | --- | --- |
  | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
  | `JWT_SECRET` | a long random string (e.g. `openssl rand -hex 32`) |
  | `PORT` | `3000` |
  | `STORAGE_DIR` | `/data/attachments` |
  | `ENRICH_AVATARS` | `true` (set `false` to skip gravatar/favicon lookups) |
  | `APP_URL` | your `web` public URL, e.g. `https://your-crm.example.com` (used in email links) |
  | `RESEND_API_KEY` | optional — a [Resend](https://resend.com) API key to enable password-reset and email-verification emails |
  | `EMAIL_FROM` | optional — sender, e.g. `Leaf CRM <noreply@yourdomain.com>` |
  | `SUPERADMIN_EMAILS` | optional — comma-separated emails granted platform-admin (manage/disable organizations) |

When `RESEND_API_KEY` + `APP_URL` are set, "Forgot password?" and admin resets send
an email; otherwise they fall back to a copyable reset link. With email configured,
new sign-ups must also confirm their address before signing in (superadmins are
exempt; existing accounts are grandfathered as verified). When email is not
configured, verification is skipped so no one is locked out.

`SUPERADMIN_EMAILS` grants the listed users a platform-admin console (user menu →
Organizations) to enable/disable any organization; members of a disabled
organization cannot sign in.

Migrations run automatically before each deploy (`node dist/migrate.js`).

## 3. Create the web service (`web`)

- New service from this repo. **Root Directory** `/` (uses the root `Dockerfile`
  and `railway.json`).
- Generate a public domain for this service.
- Variables:

  | Variable | Value |
  | --- | --- |
  | `API_ORIGIN` | `${{api.RAILWAY_PRIVATE_DOMAIN}}:3000` |

  `PORT` is provided by Railway; Caddy binds to it automatically.

## 4. First run

Open the `web` public URL. On first launch the app has no users, so it shows the
sign-up page — the first account created becomes the administrator. Additional
users can be onboarded two ways, both email-free:

- **Per-user invite:** Settings → Users → create a user → a copyable
  **set-password link** is shown to share with that person.
- **Generic invite:** Settings → Users → **Invite link** → a copyable
  **self-registration link** anyone can use to create their own (non-admin)
  account until it expires.

Admins can also delete users (their owned records are kept, just unassigned) and
users can generate a fresh set-password link for themselves from their profile.

## Local development

```bash
docker compose up -d db        # local Postgres
cd server && npm install
DATABASE_URL=postgres://crm:crm@localhost:5432/crm JWT_SECRET=dev npm run migrate
DATABASE_URL=postgres://crm:crm@localhost:5432/crm JWT_SECRET=dev STORAGE_DIR=./.attachments npm run dev
# in another shell, from the repo root:
npm run dev                    # Vite on :5173, proxies /api and /storage to the API
```

## Notes / v1 scope

- **Multi-tenant (pooled).** Every record carries an `organization_id` and the API
  scopes every query to the caller's organization, so tenants never see each other's
  data. Sign-up is open self-serve: anyone can create a new organization and becomes
  its admin. Each org has its own admins and its own settings (branding, deal stages,
  etc.). The "Create an organization" link is on the login page. Existing data is
  migrated into a default organization on first migration.
- Auth is email + password with JWT (access + refresh tokens). SSO/SAML and the
  MCP/OAuth server were intentionally dropped.
- New users onboard via a shareable set-password invite link (JWT, `INVITE_TOKEN_TTL`,
  default 7 days) or a generic self-registration link (`GENERIC_INVITE_TTL`, default
  7 days) instead of an email. Password resets issue the same kind of link.
  Wire up SMTP later if you prefer emailed links.
- Contact avatars can be uploaded/cropped in the contact form; when none is set the
  API still best-effort derives one from Gravatar / email-domain favicon.
- Attachments are stored on the Railway volume and served via `/storage/*`.
  For multi-replica or multi-region, switch to S3-compatible storage.
- The legacy Supabase code under `supabase/` and
  `src/components/atomic-crm/providers/supabase/` is no longer used by the app
  and can be removed once you are confident in the migration.
