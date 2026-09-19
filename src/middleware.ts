import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { hasSameOrigin } from "@/lib/request-origin";

const roleAccess: { prefix: string; roles: string[] }[] = [
  { prefix: "/api/invoices", roles: ["ADMIN", "ACCOUNTANT", "FINANCE"] },
  { prefix: "/api/contracts", roles: ["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS"] },
  { prefix: "/api/measurements", roles: ["ADMIN", "ACCOUNTANT", "FINANCE"] },
  { prefix: "/api/receivables", roles: ["ADMIN", "ACCOUNTANT", "FINANCE"] },
  { prefix: "/api/payables", roles: ["ADMIN", "ACCOUNTANT", "FINANCE"] },
  { prefix: "/api/bank-statements", roles: ["ADMIN", "ACCOUNTANT", "FINANCE"] },
  { prefix: "/api/reports", roles: ["ADMIN", "ACCOUNTANT", "FINANCE", "VIEWER"] },
  { prefix: "/api/exports", roles: ["ADMIN", "ACCOUNTANT", "FINANCE"] },
  { prefix: "/api/projects", roles: ["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS", "VIEWER"] },
  { prefix: "/api/partners", roles: ["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS", "VIEWER"] },
  { prefix: "/api/inventory", roles: ["ADMIN", "ACCOUNTANT", "FINANCE", "OPERATIONS", "VIEWER"] },
  { prefix: "/api/monthly-tasks", roles: ["ADMIN", "ACCOUNTANT", "FINANCE"] },
];

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/auth/")) return NextResponse.next();
  const token = request.cookies.get("access_token")?.value;
  if (!token || !process.env.JWT_SECRET) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET), { algorithms: ["HS256"] });
    const rule = roleAccess.find((item) => request.nextUrl.pathname.startsWith(item.prefix));
    if (rule && !rule.roles.includes(String(payload.role))) return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      if (!hasSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }
    return NextResponse.next();
  } catch {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}

export const config = { matcher: ["/api/:path*"] };
