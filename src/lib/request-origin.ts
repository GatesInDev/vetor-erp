type OriginRequest = { headers: Headers; nextUrl: { protocol: string } };

export function hasSameOrigin(request: OriginRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const protocol = request.nextUrl.protocol;
  return Boolean(host && origin && ["http:", "https:"].includes(protocol) && origin === `${protocol}//${host}`);
}
