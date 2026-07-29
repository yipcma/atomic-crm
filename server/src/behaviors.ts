import { createHash } from "node:crypto";
import { query } from "./db.js";
import { env } from "./env.js";

// Ports the Postgres avatar/logo enrichment (handle_contact_saved,
// handle_company_saved, get_avatar_for_email, get_domain_favicon) to the API
// layer. All lookups are best-effort and never block a write on failure.

async function fetchWithTimeout(
  url: string,
  ms = 3000,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractDomain(value: string): string | null {
  const match = value.match(
    /^(?:https?:\/\/)?(?:[^@/\n]+@)?(?:www\.)?([^:/?\n]+)/i,
  );
  return match?.[1] ?? null;
}

async function isExcludedDomain(domain: string): Promise<boolean> {
  const { rows } = await query<{ exists: boolean }>(
    "select exists(select 1 from public.favicons_excluded_domains where domain = $1) as exists",
    [domain],
  );
  return rows[0]?.exists ?? false;
}

async function getDomainFavicon(rawDomain: string): Promise<string | null> {
  const domain = extractDomain(rawDomain);
  if (!domain) return null;
  if (await isExcludedDomain(domain)) return null;
  return `https://favicon.show/${domain}`;
}

async function getAvatarForEmail(email: string): Promise<string | null> {
  try {
    const hash = createHash("sha256")
      .update(email.trim().toLowerCase())
      .digest("hex");
    const gravatar = `https://www.gravatar.com/avatar/${hash}?d=404`;
    const response = await fetchWithTimeout(gravatar);
    if (response && response.status === 200) return gravatar;
    const domain = email.split("@")[1];
    return domain ? getDomainFavicon(domain) : null;
  } catch {
    return null;
  }
}

export function lowercaseEmails(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const emails = data.email_jsonb;
  if (Array.isArray(emails)) {
    data.email_jsonb = emails.map((entry) =>
      entry &&
      typeof entry === "object" &&
      typeof (entry as any).email === "string"
        ? { ...entry, email: (entry as any).email.toLowerCase() }
        : entry,
    );
  }
  return data;
}

export async function enrichContactAvatar(
  data: Record<string, unknown>,
): Promise<void> {
  if (!env.enrichAvatars || data.avatar != null) return;
  const emails = data.email_jsonb;
  if (!Array.isArray(emails) || emails.length === 0) return;
  for (const entry of emails) {
    const email = (entry as any)?.email;
    if (typeof email !== "string") continue;
    const src = await getAvatarForEmail(email);
    if (src) {
      data.avatar = { src };
      return;
    }
  }
}

export async function enrichCompanyLogo(
  data: Record<string, unknown>,
): Promise<void> {
  if (!env.enrichAvatars || data.logo != null) return;
  const website = data.website;
  if (typeof website !== "string" || website === "") return;
  const src = await getDomainFavicon(website);
  if (src) {
    data.logo = { src, title: "Company favicon" };
  }
}
