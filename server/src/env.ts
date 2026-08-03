function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  port: Number(process.env.PORT ?? 3000),
  storageDir: process.env.STORAGE_DIR ?? "/data/attachments",
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "1h",
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL ?? "30d",
  inviteTokenTtl: process.env.INVITE_TOKEN_TTL ?? "7d",
  genericInviteTtl: process.env.GENERIC_INVITE_TTL ?? "7d",
  // Email (Resend) config; when unset, password resets fall back to a copy link.
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Leaf CRM <onboarding@resend.dev>",
  appUrl: process.env.APP_URL ?? "",
  // Platform superadmins (comma-separated emails) who can manage organizations.
  superAdminEmails: (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  // Best-effort avatar/logo enrichment via favicon/gravatar lookups.
  enrichAvatars: process.env.ENRICH_AVATARS !== "false",
  // Auth rate limits. Defaults are the production values; they are configurable
  // because an e2e run drives every signup and login from a single address and
  // would otherwise throttle itself. Raise them for test stacks rather than
  // switching the middleware off, so the limiter stays in the request path.
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 100),
  credentialRateLimitMax: Number(process.env.CREDENTIAL_RATE_LIMIT_MAX ?? 10),
  signupRateLimitMax: Number(process.env.SIGNUP_RATE_LIMIT_MAX ?? 5),
};

// Lives here rather than in auth/middleware.ts so the services layer can call it
// without importing HTTP middleware.
export function isSuperAdmin(email: string): boolean {
  return env.superAdminEmails.includes(email.trim().toLowerCase());
}
