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
