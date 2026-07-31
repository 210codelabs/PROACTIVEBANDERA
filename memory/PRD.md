# Proactive Clinic EHR — PRD & Progress

## Origin
Imported the existing **ApexCare EHR** (full Next.js 15 + Prisma + MongoDB app, FastAPI proxy) from `apexcare-ehr-handoff.zip` and **rebranded it to "Proactive Clinic"** using the client logo + brochure as the graphic reference. NOT rebuilt/MVP'd — the complete app (46 pages, 33 API routes, EHR + patient portal + admin + POS + inventory + pharmacy + i18n EN/ES) is preserved.

## Architecture (as running in this env)
- **Next.js 15** (App Router, TS, Prisma) is the whole app, served by supervisor `nextjs` (`yarn dev` -> `next dev -H 0.0.0.0 -p 3000`). Ingress routes `/api/*` and pages directly to port 3000, so the Next.js `/api` routes handle everything (the imported FastAPI proxy in `/app/backend` is kept for fidelity but not needed here).
- **MongoDB via Prisma** (`provider="mongodb"`). Prisma requires a replica set, so local mongod was converted to single-node **replica set `rs0`** (added `--replSet rs0` to supervisor mongodb + `rs.initiate`). `DATABASE_URL=mongodb://localhost:27017/proactive_clinic?replicaSet=rs0` in `/app/.env`.
- Auth: JWT (jose HS256), cookies renamed to `proactive_session` / `proactive_portal_session`. Demo password `apex123` (gated by `ALLOW_DEMO_LOGIN=true`).

## Rebrand done
- Global text `ApexCare` -> `Proactive Clinic`; email domain -> `@proactiveclinic.com`; MRN prefix `AC-` -> `PC-`.
- Logo `public/proactive-logo.png` used across landing, staff login, portal login, footer (enlarged & prominent). Hero image replaced (old one had "APEXCare" wall text).
- Color palette aligned to brochure: deep blue primary (`brand.900 #17418c`), emerald green + red accents; teal tokens/classes remapped to blue.
- **Landing + login pages redesigned to match the brochure**: big logo, "Part of the Proactive UMS Ecosystem" chip, red "NOW ACCEPTING NEW PATIENTS" badge, "Comprehensive Wellness & Recovery" tagline, wave dividers, colored circular service/why icons (blue/green/red), new "Book Your Appointment Today" blue CTA band. Login left panel = blue gradient + logo chip + ecosystem badge.
- DB wiped and **reseeded** with fresh Proactive Clinic demo data (8 staff, 10 patients, services, appts, encounters, pharmacies, inventory, POS).

## Demo credentials
- Staff: `admin@proactiveclinic.com` / `apex123` (also mariuska.aristica@, np.tan@, dpt.jones@, md.smith@, nurse.kim@, front.lopez@, billing@).
- Portal: MRN `PC-100000` / DOB `1958-04-12`.

## Verified
- `/`, `/login`, `/portal/login` return 200; login API returns 200 with `proactive_session` cookie and real seeded user. Landing + staff login visually match brochure.

## Backlog
- Recolor inner EHR shell/dashboard chrome fully to blue brand (currently functional; deeper pages use navy shell — on-brand but not brochure-refined).
- Optional: swap decorative service stock photos for brochure-consistent imagery.

## Update — Premium landing v2 + brochure services + rebrand tweaks
- **Landing redesigned (premium, new layout)**: gradient-**blended hero image** (mask `hero-bg-fade` fades photo into the background), stat strip card, brochure-style **icon service cards**, why-choose grid, rotating red "Now Accepting" seal, wave dividers, book band.
- **Services replaced with brochure list** (EN+ES): Primary Care & Preventive Care, Physical Rehabilitation, Pain Management Clinic, Wellness & Recovery Programs, Chronic Condition Monitoring, Telehealth & Follow-Up Support. Why-Choose = brochure's 4 points. Hero text updated to brochure messaging.
- **Practice Director renamed everywhere**: Mariuska→Andy, Aristica→Manzano, mariuska.aristica@→andy.manzano@ (code + DB reseeded). Verified login returns Andy Manzano.
- **Logos site-wide**: `public/pclinic-light.png` on light backgrounds (headers, portal, shell), `public/pclinic-dark.png` on dark backgrounds (staff login page + footer).
