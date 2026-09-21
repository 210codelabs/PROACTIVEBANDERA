import { db } from "@/lib/db";
import { syncWenoDirectory } from "@/lib/weno/directory";

const SETTING_KEY = "wenoDirectorySync";
const DAY_MS = 24 * 60 * 60 * 1000;
// Trigger a refresh once the directory is ~20h stale so it lands roughly daily
// regardless of when the app is used, and hold a short lock so concurrent
// searches don't launch overlapping syncs.
const STALE_MS = 20 * 60 * 60 * 1000;
const LOCK_MS = 10 * 60 * 1000;

type SyncState = { lastRunAt?: string; lastOkAt?: string; running?: boolean; startedAt?: string; lastError?: string | null; lastResult?: unknown };

async function readState(): Promise<SyncState> {
  const row = await db.appSetting.findUnique({ where: { key: SETTING_KEY } }).catch(() => null);
  return (row?.value as SyncState) || {};
}
async function writeState(patch: SyncState) {
  const cur = await readState();
  const value = { ...cur, ...patch };
  await db.appSetting.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value }, update: { value } }).catch(() => {});
}

export async function getWenoSyncStatus() {
  const s = await readState();
  const last = s.lastOkAt || s.lastRunAt;
  const stale = !last || Date.now() - new Date(last).getTime() > DAY_MS;
  return { ...s, stale, nextDueInMs: last ? Math.max(0, DAY_MS - (Date.now() - new Date(last).getTime())) : 0 };
}

/**
 * Run the incremental Weno directory sync. `force` ignores the staleness/lock
 * checks (used by the cron endpoint / admin). Returns null when it decided not
 * to run. Safe to call from a request path — it never throws.
 */
export async function runWenoDailySync(opts?: { force?: boolean }): Promise<unknown | null> {
  const force = Boolean(opts?.force);
  const s = await readState();
  const now = Date.now();
  const last = s.lastOkAt || s.lastRunAt;
  const isStale = !last || now - new Date(last).getTime() > STALE_MS;
  const lockHeld = s.running && s.startedAt && now - new Date(s.startedAt).getTime() < LOCK_MS;
  if (!force) {
    if (!isStale) return null;
    if (lockHeld) return null;
  }
  await writeState({ running: true, startedAt: new Date(now).toISOString() });
  try {
    // Incremental (changed rows + deletions) keeps it fast for a daily cadence.
    const result = await syncWenoDirectory({ daily: true });
    await writeState({ running: false, lastRunAt: new Date().toISOString(), lastOkAt: new Date().toISOString(), lastError: null, lastResult: result });
    return result;
  } catch (e: unknown) {
    await writeState({ running: false, lastRunAt: new Date().toISOString(), lastError: String((e as Error)?.message || e).slice(0, 300) });
    return null;
  }
}

/**
 * Fire-and-forget: called from the pharmacy search path. If the directory is
 * stale it kicks a background sync without blocking or affecting the response.
 */
export function maybeDailyWenoSync(): void {
  // Do not await — never let the sync delay or break a search response.
  runWenoDailySync().catch(() => {});
}
