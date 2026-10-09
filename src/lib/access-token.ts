import { Role } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";

export type Actor = { userId: string; companyId: string; role: Role; sessionId: string };

export type SessionIdentity = {
  id: string;
  userId: string;
  revokedAt: Date | null;
  expiresAt: Date;
  user: { id: string; companyId: string; role: Role; active: boolean };
};

export const accessTokenLifetimeSeconds = 900;

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
    .setExpirationTime(`${accessTokenLifetimeSeconds}s`)
    .sign(jwtKey());
}

export async function verifyAccessToken(token: string): Promise<Actor> {
  const { payload } = await jwtVerify(token, jwtKey(), { algorithms: ["HS256"], requiredClaims: ["exp", "iat", "sub"] });
  if (!payload.sub || typeof payload.companyId !== "string" || !payload.companyId || typeof payload.sessionId !== "string" || !payload.sessionId || !Object.values(Role).includes(payload.role as Role)) {
    throw new Error("Invalid access token");
  }
  return { userId: payload.sub, companyId: payload.companyId, role: payload.role as Role, sessionId: payload.sessionId };
}

export function sessionActor(actor: Actor, session: SessionIdentity | null, now = new Date()): Actor | null {
  if (!session || session.id !== actor.sessionId || session.userId !== actor.userId || session.user.id !== actor.userId || session.revokedAt || session.expiresAt <= now || !session.user.active || session.user.companyId !== actor.companyId) return null;
  return { ...actor, role: session.user.role };
}
