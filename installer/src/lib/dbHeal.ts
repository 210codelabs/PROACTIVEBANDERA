import { db } from "@/lib/db";

// One-time, per-process self-heal for a legacy MongoDB unique index that blocks
// walk-in encounters in production.
//
// Background: Encounter.appointmentId used to be a 1:1 relation (@unique). In
// MongoDB a non-sparse unique index treats a missing/null field as a single
// value, so only ONE encounter without an appointmentId (a walk-in) is allowed.
// The 2nd walk-in fails with "E11000 duplicate key ... Encounter_appointmentId_key",
// which the New Encounter page catches and bounces back to the list
// ("flicker returns to list" bug).
//
// The schema is now 1:N (no @unique), but `prisma db push` does not reliably
// drop pre-existing Mongo indexes, so we drop it explicitly. Running it lazily
// inside the Next.js server process guarantees it executes in production
// regardless of how the container is started.

let healed: Promise<void> | null = null;

async function dropStaleEncounterIndex(): Promise<void> {
  try {
    await db.$runCommandRaw({
      dropIndexes: "Encounter",
      index: "Encounter_appointmentId_key",
    });
    console.log("[dbHeal] dropped stale Encounter_appointmentId_key index");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // IndexNotFound (code 27) / NamespaceNotFound are the expected no-op cases.
    if (/IndexNotFound|not found|NamespaceNotFound|ns does not exist/i.test(msg)) {
      // Already clean — nothing to do.
      return;
    }
    // Any other error is non-fatal: never block encounter creation on the heal.
    console.warn("[dbHeal] encounter index heal skipped:", msg);
  }
}

export function ensureEncounterIndexHealed(): Promise<void> {
  if (!healed) healed = dropStaleEncounterIndex();
  return healed;
}
