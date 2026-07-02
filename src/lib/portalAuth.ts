import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";

const DEFAULT_AUTH_SECRET = "proactive-dev-secret-change-me-in-production-please-32chars+";
const PORTAL_SESSION_COOKIE = "proactive_portal_session";
const PORTAL_SESSION_DURATION_DAYS = 14;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? DEFAULT_AUTH_SECRET;
  if (secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export type PortalSession = {
  patientId: string;
  mrn: string;
  firstName: string;
  lastName: string;
  email: string | null;
};

export async function signPortalSession(session: PortalSession): Promise<string> {
  return await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PORTAL_SESSION_DURATION_DAYS}d`)
    .sign(getSecret());
}

export async function getPortalSession(): Promise<PortalSession | null> {
  const c = await cookies();
  const token = c.get(PORTAL_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      patientId: payload.patientId as string,
      mrn: payload.mrn as string,
      firstName: payload.firstName as string,
      lastName: payload.lastName as string,
      email: (payload.email as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function requirePortalSession() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  return session;
}

export async function setPortalSessionCookie(session: PortalSession) {
  const token = await signPortalSession(session);
  const c = await cookies();
  c.set(PORTAL_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    maxAge: 60 * 60 * 24 * PORTAL_SESSION_DURATION_DAYS,
    path: "/",
  });
}

export async function clearPortalSessionCookie() {
  const c = await cookies();
  c.delete(PORTAL_SESSION_COOKIE);
}
