import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { env } from "./env.js";
import { query } from "./db.js";
import { hasColumn, loadColumns } from "./columns.js";
import { assertTenantScoped } from "./rest/resources.js";
import { requireAuth } from "./auth/middleware.js";
import { ipAndEmailKey, ipKey, rateLimit } from "./auth/rateLimit.js";
import { authRoutes } from "./routes/auth.js";
import { protectedRoutes } from "./routes/protected.js";
import { adminRoutes } from "./routes/admin.js";
import { storageRoutes } from "./routes/files.js";

const app = new Hono();

// Scoped to /api/* on purpose: the storage routes set their own stricter
// per-file policy (including `sandbox`), and secureHeaders would overwrite it.
app.use(
  "/api/*",
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
    xFrameOptions: "DENY",
    referrerPolicy: "strict-origin-when-cross-origin",
  }),
);

app.get("/health", (c) => c.json({ status: "ok" }));

// Initialization gate: true once at least one account exists.
app.get("/api/init-state", async (c) => {
  const { rows } = await query<{ count: number }>(
    "select count(*)::int as count from public.sales",
  );
  return c.json({ is_initialized: (rows[0]?.count ?? 0) > 0 });
});

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// Broad ceiling across every public auth endpoint. Sized to stop automated
// abuse without tripping an office behind a single NAT address.
app.use(
  "/api/auth/*",
  rateLimit({
    limit: 100,
    windowMs: FIFTEEN_MINUTES,
    key: ipKey("auth"),
  }),
);

// Credential-guessing surfaces get a tighter, account-aware budget.
for (const path of [
  "/api/auth/login",
  "/api/auth/set-password",
  "/api/auth/verify-email",
]) {
  app.use(
    path,
    rateLimit({
      limit: 10,
      windowMs: FIFTEEN_MINUTES,
      key: ipAndEmailKey,
    }),
  );
}

// Signup is open self-serve and creates an organization row, i.e. unauthenticated
// unbounded row creation.
app.use(
  "/api/auth/signup",
  rateLimit({ limit: 5, windowMs: ONE_HOUR, key: ipKey("signup") }),
);

// Public authentication endpoints.
app.route("/api/auth", authRoutes);

// File storage (upload is auth-guarded per-route; reads are public).
app.route("/storage", storageRoutes);

// Everything else under /api requires a valid bearer token.
app.use("/api/*", requireAuth);
app.route("/api/admin", adminRoutes);
app.route("/api", protectedRoutes);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  // Malformed JSON request bodies are client errors, not server faults.
  if (err instanceof SyntaxError) {
    return c.json({ message: "Invalid JSON body" }, 400);
  }
  console.error("Unhandled error:", err);
  return c.json({ message: "Internal server error" }, 500);
});

// Exported so tests can drive the full middleware stack in-process via
// app.request(), with no listener and no port.
export { app };

// Boot-time work that must happen before the app serves traffic. Tests call
// this directly instead of starting a listener.
export async function initialize(): Promise<void> {
  await loadColumns();
  assertTenantScoped(hasColumn);
}

async function main() {
  await initialize();
  serve({ fetch: app.fetch, port: env.port }, (info) => {
    console.log(`CRM API listening on port ${info.port}`);
  });
}

// Only listen when run as the entrypoint, not when imported by a test.
if (process.env.NODE_ENV !== "test") {
  main().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}
