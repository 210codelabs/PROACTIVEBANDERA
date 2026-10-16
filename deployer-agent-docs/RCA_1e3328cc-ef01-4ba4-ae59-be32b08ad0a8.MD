# RCA — ProactiveClinics production: Patients page + staff login failing

**Deployment:** nextjs-ssr-stack (`725cd012-…`) · **Active run:** `1e3328cc-ef01-4ba4-ae59-be32b08ad0a8` (redeploy, status = success, promoted/live)
**Live URL:** https://nextjs-ssr-stack.emergent.host · arm64 · template `nextjs_mongo_shadcn_base_image` · tier_0

## Summary
Not a database, binding, secret, or data-conversion problem. The production Prisma **query engine native binary fails to load** on every query, so `db.patient.findMany()` and `db.user` lookups throw before any request reaches MongoDB. The patients page shows its catch-block banner; `login()` throws and surfaces as "invalid". This started with the amd64→arm64 / base-image migration; the latest (Weno) redeploy simply rebuilt into the same broken state — the Weno change is unrelated.

## Evidence

### (1) Exact pod error — identical for patient query AND login
```
Error [PrismaClientInitializationError]:
Details: Error loading shared library libssl.so.1.1: No such file or directory
  (needed by /app/node_modules/.prisma/client/libquery_engine-linux-musl-arm64-openssl-1.1.x.so.node)
Unable to require(`/app/node_modules/.prisma/client/libquery_engine-linux-musl-arm64-openssl-1.1.x.so.node`).
Invalid `prisma.patient.findMany()` invocation:
Invalid `prisma.user.findUnique()` invocation:
prisma:warn Prisma failed to detect the libssl/openssl version to use, and may not work as expected. Defaulting to "openssl-1.1.x".
```
The SAME error hits every model observed — `patient.findMany`, `patient.count`, `user.findUnique`, `user.findMany`, `appointment.findMany`, `order.findMany`, `encounter.findMany`, `queueEntry.findMany`, `inventoryItem.findMany`, `appSetting.upsert/findUnique`, `dotExam.findMany`. Because it is engine-wide and model-independent, this is **not** a per-field/per-document issue → rules out P2023/P2032 and the newly added optional fields (Patient.ecPhoneAlt/ecEmail, LegalCase PIP/legalNA/pipNA). It is also **not** a Mongo connection/auth/timeout error and **not** a wrong DB name — the query never reaches Mongo; the Prisma engine `.so.node` cannot be `require()`d because `libssl.so.1.1` is absent in the runtime image.

### (2) MONGO_URL / DB binding — INTACT and correct
- `MONGO_URL` present & non-empty; `DATABASE_URL` present & non-empty; `DB_NAME` present & non-empty and **matches_expected = true** for `nextjs-ssr-stack-proactive_clinic`.
- Connected read-only via the production MONGO_URL to db `nextjs-ssr-stack-proactive_clinic` — 56 collections present. The app resolves to the correct, populated database. The deploy did NOT point at a new/empty DB, and the data is not stranded under a different DB name. The `src/lib/db.ts` DB_NAME/replicaSet/pool logic is a red herring here.

### (3) Data — NO loss
- `User` count = **10** (multiple admins incl. andy@, yuri@, ernesto@, yosvani@, grethy@).
- `Patient` count = **31**.

### (4) Deploy state — completed, pods NOT crash-looping
- Run `1e3328cc` finished successfully and is the active run.
- Pods `…-8mn5k` and `…-wnt9p`: phase Running, container ready = true, restart_count = 0. The Node process boots and serves static content (`GET /` and `/login` → 200; `GET /api/auth/login` → 405 as expected). Only Prisma DB calls throw at runtime. Startup-probe warnings during rollout were just slow first-boot and cleared.

## Root cause
The generated Prisma client in the production image is using the **`linux-musl-arm64-openssl-1.1.x`** query engine, but the arm64 Alpine (musl) runtime base image ships **OpenSSL 3.x (libssl.so.3)**, not libssl.so.1.1. At `prisma generate` time Prisma could not detect the OpenSSL version ("failed to detect … Defaulting to openssl-1.1.x") and baked in the 1.1.x engine, which then cannot load at runtime → `PrismaClientInitializationError` on every query. This surfaced when the deployment migrated from amd64 to the arm64 base-image template (`nextjs_mongo_shadcn_base_image`) on 2026-10-16.

## Fix

**Primary (Code — E1, in the repo; requires redeploy):**
In `prisma/schema.prisma`, pin the generator to the musl arm64 OpenSSL 3.x engine so `prisma generate` emits the engine matching the runtime image:
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-arm64-openssl-3.0.x"]
}
```
Then redeploy. This makes Prisma use `libquery_engine-linux-musl-arm64-openssl-3.0.x.so.node`, which binds against the `libssl.so.3` present in the image. Verify by hitting `/patients` (banner gone) and POST `/api/auth/login` (200 + proactive_session cookie) against the production URL after redeploy.

**Contingency (only if the above alone doesn't clear it):** I could not confirm the image's installed libssl inside a sandbox — the eph pod failed to spawn 3× (platform-side: "pod reached terminal phase Failed"/"container not found"). If, after pinning openssl-3.0.x, the engine still cannot find an `libssl`, the runtime base image is missing the OpenSSL runtime lib and the Dockerfile must install it (`openssl`/`libssl3` for Alpine). That is a manifest/base-image change (Platform).

## Not the cause (checked)
- MONGO_URL / DATABASE_URL / DB_NAME: present, correct, points at populated prod DB.
- Data loss / empty DB: no — User=10, Patient=31.
- AUTH_SECRET: present & non-empty (login failure is the Prisma throw, not auth secret).
- Wrong password / cookie/secure/domain: no — login throws server-side in the db.user lookup.
- P2023/P2032 / schema field mismatch on new optional fields: no — error is engine-load, model-independent.
