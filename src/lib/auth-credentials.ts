export type RequestCredential =
  | { source: "bearer" | "cookie"; token: string }
  | { source: "invalid" | "none"; token: null };

export function selectRequestCredential(authorization: string | null, cookieToken?: string): RequestCredential {
  if (authorization !== null) {
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorization);
    return match ? { source: "bearer", token: match[1] } : { source: "invalid", token: null };
  }
  return cookieToken ? { source: "cookie", token: cookieToken } : { source: "none", token: null };
}

export function requiresOriginCheck(authorization: string | null): boolean {
  return selectRequestCredential(authorization).source !== "bearer";
}

export function isJsonContentType(contentType: string | null): boolean {
  return contentType?.split(";", 1)[0].trim().toLowerCase() === "application/json";
}
