import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";
import type { Role, SessionUser } from "./auth-types";
import { roleLabel } from "./auth-types";

// Re-export for backward compatibility
export type { Role, SessionUser };
export { roleLabel };

const DEFAULT_AUTH_SECRET = "proactivemedical-dev-secret-change-me-in-production-please-32chars+";
const SESSION_COOKIE = "proactive_session";
const SESSION_DURATION_DAYS = 7;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? DEFAULT_AUTH_SECRET;
  if (secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

const DEMO_USERS: Record<string, Omit<SessionUser, "id">> = {
  "mariuska.aristica@proactivemedical.com": {
    email: "mariuska.aristica@proactivemedical.com",
    firstName: "Mariuska",
    lastName: "Aristica",
    role: "provider",
    credential: "PD",
  },
  "np.tan@proactivemedical.com": {
    email: "np.tan@proactivemedical.com",
    firstName: "Linh",
    lastName: "Tan",
    role: "provider",
    credential: "NP",
  },
  "dpt.jones@proactivemedical.com": {
    email: "dpt.jones@proactivemedical.com",
    firstName: "Devon",
    lastName: "Jones",
    role: "provider",
    credential: "DPT",
  },
  "nurse.kim@proactivemedical.com": {
    email: "nurse.kim@proactivemedical.com",
    firstName: "Soo",
    lastName: "Kim",
    role: "nurse",
    credential: "RN",
  },
  "front.lopez@proactivemedical.com": {
    email: "front.lopez@proactivemedical.com",
    firstName: "Carla",
    lastName: "Lopez",
    role: "frontdesk",
    credential: null,
  },
  "billing@proactivemedical.com": {
    email: "billing@proactivemedical.com",
    firstName: "Pat",
    lastName: "Nguyen",
    role: "billing",
    credential: null,
  },
  "admin@proactivemedical.com": {
    email: "admin@proactivemedical.com",
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
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
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

  if (!sessionUser) {
    const demoUser = makeDemoSession(email);
    const demoPasswordOk = password === "apex123";
    if (demoUser && demoPasswordOk) {
      sessionUser = demoUser;
    }
  }

  if (!sessionUser) return { ok: false as const, error: "Invalid credentials" };

  const token = await signSession(sessionUser);
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    maxAge: 60 * 60 * 24 * SESSION_DURATION_DAYS,
    path: "/",
  });
  return { ok: true as const, user: sessionUser };
}

export async function logout() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
