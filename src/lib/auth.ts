import { randomBytes } from "node:crypto";
import { Role } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";

export type Actor = { userId: string; companyId: string; role: Role; sessionId: string };

function jwtKey(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? "";
  if (secret.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function issueAccessToken(actor: Actor): Promise<string> {
  return new SignJWT({ companyId: actor.companyId, role: actor.role, sessionId: actor.sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(actor.userId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(jwtKey());
}

export async function verifyAccessToken(token: string): Promise<Actor> {
  const { payload } = await jwtVerify(token, jwtKey(), { algorithms: ["HS256"] });
  if (!payload.sub || typeof payload.companyId !== "string" || typeof payload.sessionId !== "string" || !Object.values(Role).includes(payload.role as Role)) {
    throw new Error("Invalid access token");
  }
  return { userId: payload.sub, companyId: payload.companyId, role: payload.role as Role, sessionId: payload.sessionId };
}

export async function currentActor(): Promise<Actor | null> {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) return null;
  try {
    const actor = await verifyAccessToken(token);
    const session = await db.session.findFirst({ where: { id: actor.sessionId, userId: actor.userId, revokedAt: null, expiresAt: { gt: new Date() }, user: { active: true, companyId: actor.companyId } }, select: { user: { select: { role: true } } } });
    return session ? { ...actor, role: session.user.role } : null;
  } catch {
    return null;
  }
}

export function authorize(actor: Actor | null, allowed: Role[]): Actor {
  if (!actor) throw new HttpError(401, "Authentication required");
  if (!allowed.includes(actor.role)) throw new HttpError(403, "Permission denied");
  return actor;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function createRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function refreshHash(token: string): string {
  return sha256(token);
}

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set("access_token", accessToken, { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: 900 });
  jar.set("refresh_token", refreshToken, { httpOnly: true, secure, sameSite: "strict", path: "/api/auth", maxAge: 60 * 60 * 24 * 30 });
}

export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete("access_token");
  jar.delete("refresh_token");
}
