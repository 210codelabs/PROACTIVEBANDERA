import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";

const DEFAULT_AUTH_SECRET = "proactive-dev-secret-change-me-in-production-please-32chars+";
const PORTAL_SESSION_COOKIE = "proactive_portal_session";
// Compliance: 5-minute rolling session for the patient portal too.
const PORTAL_TTL_SECONDS = 5 * 60;
const PORTAL_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
  path: "/",
};

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
    .setExpirationTime(`${PORTAL_TTL_SECONDS}s`)
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
  c.set(PORTAL_SESSION_COOKIE, token, { ...PORTAL_COOKIE_OPTS, maxAge: PORTAL_TTL_SECONDS });
}

export async function refreshPortalSession(): Promise<boolean> {
  const session = await getPortalSession();
  if (!session) return false;
  await setPortalSessionCookie(session);
  return true;
}

export async function clearPortalSessionCookie() {
  const c = await cookies();
  c.set(PORTAL_SESSION_COOKIE, "", { ...PORTAL_COOKIE_OPTS, maxAge: 0 });
}
