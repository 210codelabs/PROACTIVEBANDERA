import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const DEFAULT_AUTH_SECRET = "proactive-dev-secret-change-me-in-production-please-32chars+";

const PUBLIC_EXACT = ["/", "/login", "/landing", "/book", "/demo", "/intake", "/manifest.webmanifest", "/sw.js"];
const PUBLIC_PREFIX = [
  "/legal",
  "/kiosk",
  "/attorney",
  "/book",
  "/guide",
  "/api/guide",
  "/api/kiosk",
  "/api/intake/forms",
  "/api/intake/submit",
  "/api/intake/drug-search",
  "/api/demo",
  "/api/attorney",
  "/api/assistant",
  "/api/appointments/request",
  "/api/fhir/jwks",
  "/api/stedi/webhook",
  "/api/weno/online-callback",
  "/api/credentialing/twilio",
  "/waitlist/confirm",
  "/api/waitlist/confirm",
  "/enterprise/dot/kiosk",
  "/api/enterprise/dot/kiosk",
  "/api/internal/dot-reminders",
  "/api/internal/weno-apply-env",
  "/api/internal/credentialing-recheck",
  "/api/compare",
  "/api/v1",
  "/fhir",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/admin/config/public",
  "/api/net/egress-ip",
  "/_next",
  "/favicon.ico",
  "/icon-",
  "/apple-touch-icon",
];

const PORTAL_PUBLIC_PATHS = [
  "/portal",
  "/portal/login",
  "/api/portal/auth/login",
  "/api/portal/auth/logout",
];

const ENTERPRISE_PUBLIC_PATHS = [
  "/enterprise/login",
  "/api/enterprise/auth/login",
  "/api/enterprise/auth/logout",
];

const EMPLOYEE_PUBLIC_PATHS = [
  "/enterprise/employee/login",
  "/api/enterprise/employee-portal/login",
  "/api/enterprise/employee-portal/logout",
];

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? DEFAULT_AUTH_SECRET;
  return new TextEncoder().encode(secret);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_EXACT.includes(pathname)) return NextResponse.next();
  if (PUBLIC_PREFIX.some(p => pathname.startsWith(p))) return NextResponse.next();

  const isPortalPath = pathname.startsWith("/portal") || pathname.startsWith("/api/portal");
  if (isPortalPath && PORTAL_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const isEmployeePath = pathname.startsWith("/enterprise/employee") || pathname.startsWith("/api/enterprise/employee-portal");
  if (isEmployeePath && EMPLOYEE_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const isEnterprisePath = !isEmployeePath && (pathname.startsWith("/enterprise") || pathname.startsWith("/api/enterprise"));
  if (isEnterprisePath && ENTERPRISE_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  if (pathname.match(/\.(?:png|jpg|jpeg|svg|ico|gif|webp|woff2?|css|js|map|pdf)$/)) {
    return NextResponse.next();
  }

  const token = isEmployeePath
    ? req.cookies.get("proactive_employee_session")?.value
    : isEnterprisePath
    ? req.cookies.get("proactive_enterprise_session")?.value
    : isPortalPath
    ? req.cookies.get("proactive_portal_session")?.value
    : req.cookies.get("proactive_session")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = req.nextUrl.clone();
    url.pathname = isEmployeePath ? "/enterprise/employee/login" : isEnterprisePath ? "/enterprise/login" : isPortalPath ? "/portal/login" : "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  try {
    await jwtVerify(token, getSecret());
    const res = NextResponse.next();
    // Compliance: never let authenticated pages be restored from cache after logout.
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");
    return res;
  } catch {
    if (pathname.startsWith("/api/")) {
      const apiRes = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (isEmployeePath) apiRes.cookies.delete("proactive_employee_session");
      else if (isEnterprisePath) apiRes.cookies.delete("proactive_enterprise_session");
      else if (isPortalPath) apiRes.cookies.delete("proactive_portal_session");
      else apiRes.cookies.delete("proactive_session");
      return apiRes;
    }

    const url = req.nextUrl.clone();
    url.pathname = isEmployeePath ? "/enterprise/employee/login" : isEnterprisePath ? "/enterprise/login" : isPortalPath ? "/portal/login" : "/login";
    url.searchParams.set("next", pathname);
    const res = NextResponse.redirect(url);
    if (isEmployeePath) res.cookies.delete("proactive_employee_session");
    else if (isEnterprisePath) res.cookies.delete("proactive_enterprise_session");
    else if (isPortalPath) res.cookies.delete("proactive_portal_session");
    else res.cookies.delete("proactive_session");
    return res;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
