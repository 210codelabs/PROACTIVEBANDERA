import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const DEFAULT_AUTH_SECRET = "proactive-dev-secret-change-me-in-production-please-32chars+";
const ATTORNEY_COOKIE = "proactive_attorney_session";
const TTL_SECONDS = 30 * 60;
const OPTS = { httpOnly: true, sameSite: "none" as const, secure: true, path: "/" };

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? DEFAULT_AUTH_SECRET;
  return new TextEncoder().encode(secret);
}

export type AttorneySession = { attorneyId: string; name: string; firm: string | null; email: string };

export async function setAttorneySessionCookie(s: AttorneySession) {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecret());
  const c = await cookies();
  c.set(ATTORNEY_COOKIE, token, { ...OPTS, maxAge: TTL_SECONDS });
}

export async function getAttorneySession(): Promise<AttorneySession | null> {
  const c = await cookies();
  const token = c.get(ATTORNEY_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      attorneyId: payload.attorneyId as string,
      name: payload.name as string,
      firm: (payload.firm as string | null) ?? null,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

export async function clearAttorneySessionCookie() {
  const c = await cookies();
  c.set(ATTORNEY_COOKIE, "", { ...OPTS, maxAge: 0 });
}
