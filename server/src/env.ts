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
  // Best-effort avatar/logo enrichment via favicon/gravatar lookups.
  enrichAvatars: process.env.ENRICH_AVATARS !== "false",
};
