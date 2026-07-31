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

## Update — Team photos, portal quick actions, testimonials, location map
- **Team section**: real provider headshots (Unsplash) replacing initials avatars.
- **Landing testimonials**: new "What Our Patients Say" section with 3 patient reviews (5-star, colored avatars), bilingual EN/ES; added to nav flow.
- **Location map**: Google Maps embed (no API key, `output=embed`) in the Contact section next to insurance/CTA card.
- **Portal quick actions**: 4 colored action cards (Appointments, Messages, Documents, AI Assistant) on the patient portal dashboard linking to portal routes. Added `portal.quickActions` i18n key (EN/ES).
- All verified 200 with no compile errors.

## Update — AI assistant (GPT-4o) + portal booking + landing hero redesign
- **AI assistant**: portal assistant now routes free-form/FAQ messages to OpenAI GPT-4o via `emergentintegrations` + `EMERGENT_LLM_KEY` (env: PORTAL_MODEL_PROVIDER=openai, PORTAL_MODEL_ID=gpt-4o). Scheduling/reschedule/cancel/lookup stay rule-based. System prompt injects Proactive Clinic facts; bilingual EN/ES; refuses medical/dosage advice; falls back to rules on LLM error. File: src/app/api/portal/assistant/route.ts.
- **Portal appointment booking**: new POST /api/portal/appointments creates a real Appointment (status "requested") in MongoDB via Prisma; UI form component src/components/portal/PortalBookingForm.tsx on /portal/appointments (opened from the "Appointments" quick action). Validates future date/time + auth.
- **Rebrand fix**: persisted admin config lfs/tmp/admin-console.json rebranded ApexCare -> Proactive Clinic (was surfacing in assistant answers).
- **Landing hero redesign** (per client reference layout): full-bleed **slideshow background** (4 images, crossfade) with blue scrim; left = heading/tagline/subtitle + trust chips (Hablamos Español, Home Visits, Most Insurances); right = **tabbed auth card** (Patient Portal MRN+DOB / Staff Access email+password) posting to existing auth endpoints. Header restyled (bigger logo, nav, phone, "Schedule a Visit"). Component: src/components/HeroAuth.tsx.
- Backend for all above tested & passing via deep_testing_backend_nextjs.

## Update — Iteration 2 (services w/ photos, assistant suggestions, booking confirmation, hero login fix)
- **Services redesign**: landing service cards now show a photo with an overlapping colored icon badge (brochure style); 6 local images /public/svc-1..6.jpg.
- **Assistant suggestions**: portal assistant shows language-aware "Suggested questions" FAQ chips (GPT-4o answers).
- **Booking confirmation**: POST /api/portal/appointments returns a confirmationNumber (PC-XXXXXX) and creates a front-desk notification Message; the portal booking form shows a green confirmation panel (number + summary). Backend re-tested (all pass).
- **Hero tabbed login bugfix**: staff login was not redirecting (net::ERR_ABORTED) due to router.push()+refresh(); switched HeroAuth to full-page window.location.assign() for both Patient Portal and Staff Access tabs. Frontend testing agent verified staff -> /dashboard and patient -> /portal/dashboard both work.
- Frontend & backend testing agents: all Iteration 2 tasks passing.
