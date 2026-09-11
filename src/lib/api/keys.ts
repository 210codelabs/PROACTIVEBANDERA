import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ApiScope } from "./scopes";

// -------------------------------------------------------------
// Credential generation & hashing
// -------------------------------------------------------------
export function generateCredentials() {
  const keyId = "pck_" + crypto.randomBytes(9).toString("hex"); // 18 hex chars
  const secret = "pcs_" + crypto.randomBytes(24).toString("hex"); // 48 hex chars
  return { keyId, secret };
}

export function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// CORS + JSON helpers (external apps call these cross-origin)
// -------------------------------------------------------------
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, X-API-Key, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function corsPreflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export function apiJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: CORS_HEADERS });
}

// -------------------------------------------------------------
// Authentication
// -------------------------------------------------------------
function extractToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const x = req.headers.get("x-api-key");
  if (x) return x.trim();
  return null;
}

export type AuthedClient = {
  id: string;
  name: string;
  keyId: string;
  scopes: string[];
  rateLimitPerMin: number;
};

type AuthResult =
  | { ok: true; client: AuthedClient }
  | { ok: false; res: NextResponse };

// Very lightweight in-memory rate limiter (per process). Best-effort only.
const rlBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimited(keyId: string, perMin: number): boolean {
  const now = Date.now();
  const b = rlBuckets.get(keyId);
  if (!b || now > b.resetAt) {
    rlBuckets.set(keyId, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  b.count += 1;
  return b.count > perMin;
}

export async function authenticate(req: Request, requiredScope?: ApiScope): Promise<AuthResult> {
  const token = extractToken(req);
  if (!token || !token.includes(".")) {
    return {
      ok: false,
      res: apiError(401, "unauthorized", "Missing or malformed API credentials. Send header 'Authorization: Bearer <keyId>.<secret>' or 'X-API-Key: <keyId>.<secret>'."),
    };
  }
  const idx = token.indexOf(".");
  const keyId = token.slice(0, idx);
  const secret = token.slice(idx + 1);

  let client: { id: string; name: string; keyId: string; secretHash: string; scopes: string[]; active: boolean; rateLimitPerMin: number } | null = null;
  try {
    client = await db.apiClient.findUnique({ where: { keyId } });
  } catch {
    return { ok: false, res: apiError(503, "unavailable", "Service temporarily unavailable.") };
  }
  if (!client || !client.active) {
    return { ok: false, res: apiError(401, "unauthorized", "Invalid or revoked API key.") };
  }
  if (!safeEqualHex(hashSecret(secret), client.secretHash)) {
    return { ok: false, res: apiError(401, "unauthorized", "Invalid API secret.") };
  }
  if (rateLimited(keyId, client.rateLimitPerMin || 120)) {
    return { ok: false, res: apiError(429, "rate_limited", "Rate limit exceeded. Slow down and retry shortly.") };
  }
  if (requiredScope && !client.scopes.includes(requiredScope)) {
    return { ok: false, res: apiError(403, "forbidden", `This API key is missing the required scope '${requiredScope}'.`) };
  }
  return {
    ok: true,
    client: { id: client.id, name: client.name, keyId: client.keyId, scopes: client.scopes, rateLimitPerMin: client.rateLimitPerMin },
  };
}

async function logRequest(clientId: string, req: Request, status: number, startedAt: number) {
  try {
    const url = new URL(req.url);
    await db.apiClient.update({ where: { id: clientId }, data: { lastUsedAt: new Date(), requestCount: { increment: 1 } } });
    await db.apiRequestLog.create({
      data: { clientId, method: req.method, path: url.pathname, status, durationMs: Math.max(0, Date.now() - startedAt) },
    });
  } catch {
    // logging must never break the request
  }
}

// Wrap a v1 route handler: authenticate, enforce scope, run, log usage.
export async function handleApi(
  req: Request,
  scope: ApiScope | null,
  fn: (client: AuthedClient) => Promise<NextResponse>,
): Promise<NextResponse> {
  const started = Date.now();
  const auth = await authenticate(req, scope ?? undefined);
  if (!auth.ok) return auth.res;
  let res: NextResponse;
  try {
    res = await fn(auth.client);
  } catch {
    res = apiError(500, "server_error", "Unexpected error handling the request.");
  }
  void logRequest(auth.client.id, req, res.status, started);
  return res;
}
