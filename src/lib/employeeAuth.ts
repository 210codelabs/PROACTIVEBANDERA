import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";

const DEFAULT_AUTH_SECRET = "proactive-dev-secret-change-me-in-production-please-32chars+";
const EMP_SESSION_COOKIE = "proactive_employee_session";
const EMP_TTL_SECONDS = 30 * 60;
const EMP_COOKIE_OPTS = { httpOnly: true, sameSite: "none" as const, secure: true, path: "/" };

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? DEFAULT_AUTH_SECRET;
  if (secret.length < 32) throw new Error("AUTH_SECRET must be set and at least 32 characters");
  return new TextEncoder().encode(secret);
}

export type EmployeeSession = {
  employeeId: string;
  enterpriseId: string;
  patientId: string | null;
  name: string;
  companyName: string;
};

export async function getEmployeeSession(): Promise<EmployeeSession | null> {
  const c = await cookies();
  const token = c.get(EMP_SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      employeeId: payload.employeeId as string,
      enterpriseId: payload.enterpriseId as string,
      patientId: (payload.patientId as string) || null,
      name: payload.name as string,
      companyName: payload.companyName as string,
    };
  } catch {
    return null;
  }
}

export async function requireEmployeeSession() {
  const s = await getEmployeeSession();
  if (!s) redirect("/enterprise/employee/login");
  return s;
}

export async function setEmployeeSessionCookie(s: EmployeeSession) {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EMP_TTL_SECONDS}s`)
    .sign(getSecret());
  const c = await cookies();
  c.set(EMP_SESSION_COOKIE, token, { ...EMP_COOKIE_OPTS, maxAge: EMP_TTL_SECONDS });
}

export async function clearEmployeeSessionCookie() {
  const c = await cookies();
  c.set(EMP_SESSION_COOKIE, "", { ...EMP_COOKIE_OPTS, maxAge: 0 });
}
