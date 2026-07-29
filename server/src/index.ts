import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "./env.js";
import { query } from "./db.js";
import { loadColumns } from "./columns.js";
import { requireAuth } from "./auth/middleware.js";
import { authRoutes } from "./routes/auth.js";
import { protectedRoutes } from "./routes/protected.js";
import { storageRoutes } from "./routes/files.js";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

// Initialization gate: true once at least one account exists.
app.get("/api/init-state", async (c) => {
  const { rows } = await query<{ count: number }>(
    "select count(*)::int as count from public.sales",
  );
  return c.json({ is_initialized: (rows[0]?.count ?? 0) > 0 });
});

// Public authentication endpoints.
app.route("/api/auth", authRoutes);

// File storage (upload is auth-guarded per-route; reads are public).
app.route("/storage", storageRoutes);

// Everything else under /api requires a valid bearer token.
app.use("/api/*", requireAuth);
app.route("/api", protectedRoutes);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }
  console.error("Unhandled error:", err);
  return c.json({ message: "Internal server error" }, 500);
});

async function main() {
  await loadColumns();
  serve({ fetch: app.fetch, port: env.port }, (info) => {
    console.log(`CRM API listening on port ${info.port}`);
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
