import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { Role } from "@prisma/client";
import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { accessTokenLifetimeSeconds, issueAccessToken, sessionActor, verifyAccessToken, type Actor } from "@/lib/access-token";
import { selectRequestCredential } from "@/lib/auth-credentials";
import { rotateStoredSession } from "@/lib/refresh-session";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";

export { issueAccessToken, verifyAccessToken };
export type { Actor };

export async function currentActor(request?: NextRequest): Promise<Actor | null> {
  const authorization = (request?.headers ?? await headers()).get("authorization");
  const cookieToken = authorization === null ? (request?.cookies ?? await cookies()).get("access_token")?.value : undefined;
  const credential = selectRequestCredential(authorization, cookieToken);
  if (!credential.token) return null;
  try {
    const actor = await verifyAccessToken(credential.token);
    const session = await db.session.findUnique({ where: { id: actor.sessionId }, select: { id: true, userId: true, revokedAt: true, expiresAt: true, user: { select: { id: true, companyId: true, role: true, active: true } } } });
    return sessionActor(actor, session);
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

export async function loginSession(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user?.active || !(await argon2.verify(user.passwordHash, password))) throw new HttpError(401, "Invalid credentials");
  const refreshToken = createRefreshToken();
  const session = await db.session.create({ data: { userId: user.id, refreshHash: refreshHash(refreshToken), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
  return sessionTokens(session.id, session.expiresAt, user, refreshToken);
}

export async function rotateSession(token: string) {
  const oldHash = refreshHash(token);
  const refreshToken = createRefreshToken();
  const session = await db.$transaction((transaction) => rotateStoredSession({
    find: (hash) => transaction.session.findUnique({ where: { refreshHash: hash }, include: { user: true } }),
    replaceHash: async (sessionId, previousHash, nextHash, now) => {
      const updated = await transaction.session.updateMany({ where: { id: sessionId, refreshHash: previousHash, revokedAt: null, expiresAt: { gt: now }, user: { active: true } }, data: { refreshHash: nextHash } });
      return updated.count === 1;
    },
  }, oldHash, refreshHash(refreshToken)));
  if (!session) throw new HttpError(401, "Session expired");
  return sessionTokens(session.id, session.expiresAt, session.user, refreshToken);
}

export async function revokeRefreshSession(token: string): Promise<void> {
  await db.session.updateMany({ where: { refreshHash: refreshHash(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

async function sessionTokens(sessionId: string, expiresAt: Date, user: { id: string; companyId: string; email: string; role: Role }, refreshToken: string) {
  return {
    accessToken: await issueAccessToken({ userId: user.id, companyId: user.companyId, role: user.role, sessionId }),
    refreshToken,
    tokenType: "Bearer" as const,
    expiresIn: accessTokenLifetimeSeconds,
    refreshExpiresAt: expiresAt.toISOString(),
    user: { id: user.id, companyId: user.companyId, email: user.email, role: user.role },
  };
}

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set("access_token", accessToken, { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: 900 });
  jar.set("refresh_token", refreshToken, { httpOnly: true, secure, sameSite: "strict", path: "/api/auth", maxAge: 60 * 60 * 24 * 30 });
}

export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set("access_token", "", { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: 0 });
  jar.set("refresh_token", "", { httpOnly: true, secure, sameSite: "strict", path: "/api/auth", maxAge: 0 });
}
