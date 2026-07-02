import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const DEFAULT_AUTH_SECRET = "proactive-dev-secret-change-me-in-production-please-32chars+";
const PUBLIC_PATHS = [
  "/login",
  "/landing",
  "/api/assistant",
  "/api/auth/login",
  "/api/admin/config/public",
  "/_next",
  "/favicon.ico",
];

const PORTAL_PUBLIC_PATHS = [
  "/portal",
  "/portal/login",
  "/api/portal/auth/login",
  "/api/portal/auth/logout",
];

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? DEFAULT_AUTH_SECRET;
  return new TextEncoder().encode(secret);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/") return NextResponse.next();
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();

  const isPortalPath = pathname.startsWith("/portal") || pathname.startsWith("/api/portal");
  if (isPortalPath && PORTAL_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  if (pathname.match(/\.(?:png|jpg|jpeg|svg|ico|gif|webp|woff2?|css|js|map)$/)) {
    return NextResponse.next();
  }

  const token = isPortalPath
    ? req.cookies.get("proactive_portal_session")?.value
    : req.cookies.get("proactive_session")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = req.nextUrl.clone();
    url.pathname = isPortalPath ? "/portal/login" : "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  try {
    await jwtVerify(token, getSecret());
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      const apiRes = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (isPortalPath) {
        apiRes.cookies.delete("proactive_portal_session");
      } else {
        apiRes.cookies.delete("proactive_session");
      }
      return apiRes;
    }

    const url = req.nextUrl.clone();
    url.pathname = isPortalPath ? "/portal/login" : "/login";
    url.searchParams.set("next", pathname);
    const res = NextResponse.redirect(url);
    if (isPortalPath) {
      res.cookies.delete("proactive_portal_session");
    } else {
      res.cookies.delete("proactive_session");
    }
    return res;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
