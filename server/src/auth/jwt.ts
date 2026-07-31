import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "../env.js";

const secret = new TextEncoder().encode(env.jwtSecret);

export interface AccessClaims extends JWTPayload {
  sub: string; // user id
  type: "access";
}

export interface RefreshClaims extends JWTPayload {
  sub: string;
  type: "refresh";
}

export interface InviteClaims extends JWTPayload {
  sub: string; // user id
  type: "invite";
}

export interface SignupInviteClaims extends JWTPayload {
  type: "signup-invite";
  org: number;
}

export interface VerifyEmailClaims extends JWTPayload {
  sub: string; // user id
  type: "verify-email";
}

export function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(env.accessTokenTtl)
    .sign(secret);
}

export function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(env.refreshTokenTtl)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, secret);
  if (payload.type !== "access") {
    throw new Error("Invalid token type");
  }
  return payload as AccessClaims;
}

export async function verifyRefreshToken(
  token: string,
): Promise<RefreshClaims> {
  const { payload } = await jwtVerify(token, secret);
  if (payload.type !== "refresh") {
    throw new Error("Invalid token type");
  }
  return payload as RefreshClaims;
}

// Single-use-ish link token an admin shares so a user can set their password
// without email delivery. Longer-lived than an access token.
export function signInviteToken(userId: string): Promise<string> {
  return new SignJWT({ type: "invite" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(env.inviteTokenTtl)
    .sign(secret);
}

export async function verifyInviteToken(token: string): Promise<InviteClaims> {
  const { payload } = await jwtVerify(token, secret);
  if (payload.type !== "invite") {
    throw new Error("Invalid token type");
  }
  return payload as InviteClaims;
}

// Generic, user-agnostic invite an admin shares so anyone with the link can
// self-register a (non-admin) account into a specific organization.
export function signSignupInviteToken(organizationId: number): Promise<string> {
  return new SignJWT({ type: "signup-invite", org: organizationId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(env.genericInviteTtl)
    .sign(secret);
}

export async function verifySignupInviteToken(
  token: string,
): Promise<SignupInviteClaims> {
  const { payload } = await jwtVerify(token, secret);
  if (payload.type !== "signup-invite") {
    throw new Error("Invalid token type");
  }
  return payload as SignupInviteClaims;
}

export function signVerifyEmailToken(userId: string): Promise<string> {
  return new SignJWT({ type: "verify-email" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(env.inviteTokenTtl)
    .sign(secret);
}

export async function verifyVerifyEmailToken(
  token: string,
): Promise<VerifyEmailClaims> {
  const { payload } = await jwtVerify(token, secret);
  if (payload.type !== "verify-email") {
    throw new Error("Invalid token type");
  }
  return payload as VerifyEmailClaims;
}
