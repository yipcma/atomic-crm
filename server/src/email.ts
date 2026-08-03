import { env } from "./env.js";

// Email delivery via Resend's REST API (https://resend.com) using fetch, so no
// extra npm dependency. Configure RESEND_API_KEY, EMAIL_FROM and APP_URL to
// enable it; when unset, callers fall back to showing a copyable link instead.
export function isEmailEnabled(): boolean {
  return Boolean(env.resendApiKey && env.appUrl);
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.emailFrom, to, subject, html }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Email send failed (${response.status}): ${body}`);
  }
}

// The app uses hash routing, so the token lives in the hash.
export function resetLink(token: string): string {
  return `${env.appUrl}/#/set-password?token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  const link = resetLink(token);
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="font-size: 18px;">Reset your password</h2>
      <p>Someone requested a password reset for your account. Click the button
        below to choose a new password. This link expires soon.</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background: #111; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">
          Set a new password
        </a>
      </p>
      <p style="color: #666; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
    </div>`;
  await sendEmail(to, "Reset your password", html);
}

export function verificationLink(token: string): string {
  return `${env.appUrl}/#/verify-email?token=${encodeURIComponent(token)}`;
}

export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const link = verificationLink(token);
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="font-size: 18px;">Confirm your email</h2>
      <p>Welcome! Please confirm your email address to activate your account.</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background: #111; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">
          Verify email
        </a>
      </p>
      <p style="color: #666; font-size: 13px;">If you didn't create this account, you can ignore this email.</p>
    </div>`;
  await sendEmail(to, "Verify your email", html);
}
