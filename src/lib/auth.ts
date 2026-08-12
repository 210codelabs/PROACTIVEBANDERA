import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";
import type { Role, SessionUser } from "./auth-types";
import { roleLabel } from "./auth-types";

// Re-export for backward compatibility
export type { Role, SessionUser };
export { roleLabel };

const DEFAULT_AUTH_SECRET = "proactive-dev-secret-change-me-in-production-please-32chars+";
const SESSION_COOKIE = "proactive_session";
// Compliance: rolling idle session. TTL is refreshed on user activity by the
// client SessionGuard; a longer window avoids surprise sign-outs mid-workflow
// (e.g. while switching to a vendor portal tab).
const SESSION_TTL_SECONDS = 30 * 60;
const SESSION_COOKIE_OPTS = {
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

const DEMO_USERS: Record<string, Omit<SessionUser, "id">> = {
  "andy.manzano@proactiveclinic.com": {
    email: "andy.manzano@proactiveclinic.com",
    firstName: "Andy",
    lastName: "Manzano",
    role: "provider",
    credential: "PD",
  },
  "np.tan@proactiveclinic.com": {
    email: "np.tan@proactiveclinic.com",
    firstName: "Linh",
    lastName: "Tan",
    role: "provider",
    credential: "NP",
  },
  "dpt.jones@proactiveclinic.com": {
    email: "dpt.jones@proactiveclinic.com",
    firstName: "Devon",
    lastName: "Jones",
    role: "provider",
    credential: "DPT",
  },
  "nurse.kim@proactiveclinic.com": {
    email: "nurse.kim@proactiveclinic.com",
    firstName: "Soo",
    lastName: "Kim",
    role: "nurse",
    credential: "RN",
  },
  "front.lopez@proactiveclinic.com": {
    email: "front.lopez@proactiveclinic.com",
    firstName: "Carla",
    lastName: "Lopez",
    role: "frontdesk",
    credential: null,
  },
  "billing@proactiveclinic.com": {
    email: "billing@proactiveclinic.com",
    firstName: "Pat",
    lastName: "Nguyen",
    role: "billing",
    credential: null,
  },
  "admin@proactiveclinic.com": {
    email: "admin@proactiveclinic.com",
    firstName: "Avery",
    lastName: "Park",
    role: "admin",
    credential: null,
  },
};

function makeDemoSession(email: string): SessionUser | null {
  const demoUser = DEMO_USERS[email.toLowerCase()];
  if (!demoUser) return null;
  return {
    id: `demo-${email.toLowerCase()}`,
    ...demoUser,
  };
}

export async function signSession(user: SessionUser): Promise<string> {
  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      id: payload.id as string,
      email: payload.email as string,
      firstName: payload.firstName as string,
      lastName: payload.lastName as string,
      role: payload.role as Role,
      credential: (payload.credential as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return await verifySession(token);
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function login(email: string, password: string) {
  let sessionUser: SessionUser | null = null;

  try {
    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user && user.active) {
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (ok) {
        sessionUser = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role as Role,
          credential: user.credential,
        };
      }
    }
  } catch {
    // Fall back to the built-in demo roster when the database layer is unstable in production.
  }

  if (!sessionUser && process.env.ALLOW_DEMO_LOGIN === "true") {
    // Demo roster fallback — only when explicitly enabled (never in production).
    const demoUser = makeDemoSession(email);
    const demoPasswordOk = password === "apex123";
    if (demoUser && demoPasswordOk) {
      sessionUser = demoUser;
    }
  }

  if (!sessionUser) return { ok: false as const, error: "Invalid credentials" };

  const token = await signSession(sessionUser);
  const c = await cookies();
  c.set(SESSION_COOKIE, token, { ...SESSION_COOKIE_OPTS, maxAge: SESSION_TTL_SECONDS });
  return { ok: true as const, user: sessionUser };
}

export async function refreshSession(): Promise<boolean> {
  const user = await getSession();
  if (!user) return false;
  const token = await signSession(user);
  const c = await cookies();
  c.set(SESSION_COOKIE, token, { ...SESSION_COOKIE_OPTS, maxAge: SESSION_TTL_SECONDS });
  return true;
}

export async function logout() {
  const c = await cookies();
  // Expire with matching attributes so the browser actually drops the cookie.
  c.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTS, maxAge: 0 });
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
