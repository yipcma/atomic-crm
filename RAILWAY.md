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
users are created from **Settings → Users**: creating a user produces a
**set-password invite link** (shown to the admin) to share with the new user. No
email service is required. Users can also generate a fresh set-password link for
themselves from their profile.

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

- Auth is email + password with JWT (access + refresh tokens). SSO/SAML and the
  MCP/OAuth server were intentionally dropped.
- New users onboard via a shareable set-password invite link (JWT, `INVITE_TOKEN_TTL`,
  default 7 days) instead of an email. Password resets issue the same kind of link.
  Wire up SMTP later if you prefer emailed links.
- Contact avatars can be uploaded/cropped in the contact form; when none is set the
  API still best-effort derives one from Gravatar / email-domain favicon.
- Attachments are stored on the Railway volume and served via `/storage/*`.
  For multi-replica or multi-region, switch to S3-compatible storage.
- The legacy Supabase code under `supabase/` and
  `src/components/atomic-crm/providers/supabase/` is no longer used by the app
  and can be removed once you are confident in the migration.
