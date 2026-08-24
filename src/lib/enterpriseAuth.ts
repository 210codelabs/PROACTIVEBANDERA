import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";

const DEFAULT_AUTH_SECRET = "proactive-dev-secret-change-me-in-production-please-32chars+";
const ENT_SESSION_COOKIE = "proactive_enterprise_session";
const ENT_TTL_SECONDS = 30 * 60;
const ENT_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
  path: "/",
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? DEFAULT_AUTH_SECRET;
  if (secret.length < 32) throw new Error("AUTH_SECRET must be set and at least 32 characters");
  return new TextEncoder().encode(secret);
}

export type EnterpriseSession = {
  portalUserId: string;
  enterpriseId: string;
  companyName: string;
  name: string;
  email: string;
};

export async function signEnterpriseSession(s: EnterpriseSession): Promise<string> {
  return await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ENT_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function getEnterpriseSession(): Promise<EnterpriseSession | null> {
  const c = await cookies();
  const token = c.get(ENT_SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      portalUserId: payload.portalUserId as string,
      enterpriseId: payload.enterpriseId as string,
      companyName: payload.companyName as string,
      name: payload.name as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

export async function requireEnterpriseSession() {
  const s = await getEnterpriseSession();
  if (!s) redirect("/enterprise/login");
  return s;
}

export async function setEnterpriseSessionCookie(s: EnterpriseSession) {
  const token = await signEnterpriseSession(s);
  const c = await cookies();
  c.set(ENT_SESSION_COOKIE, token, { ...ENT_COOKIE_OPTS, maxAge: ENT_TTL_SECONDS });
}

export async function clearEnterpriseSessionCookie() {
  const c = await cookies();
  c.set(ENT_SESSION_COOKIE, "", { ...ENT_COOKIE_OPTS, maxAge: 0 });
}

export const ENTERPRISE_SESSION_COOKIE = ENT_SESSION_COOKIE;
