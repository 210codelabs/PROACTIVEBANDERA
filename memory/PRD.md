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

## Iteration 3 (reference/master-data dropdowns + landing polish)
- **Landing polish**: hero slide 1 = warm diverse clinical team; removed clinic-sign overlay per user; footer darkened (#05080f); service images updated (Physical Rehab = therapist assisting exercise, Pain Mgmt = knee treatment close-up); Telehealth card now styled as a live video-call with Proactive Clinic logo on the "screen" (+LIVE badge + call controls). Miami references cleaned from assistant prompt + pharmacy fallback (San Antonio/210). EHR top-bar phone fixed to (210) 500-2914.
- **Reference/master data catalog (RefData)**: new Prisma model RefData(type, code, display, system, data JSON, sortOrder, active; @@unique[type,display]). Seed script scripts/seed-refdata.mjs loads 292 USA-standard values across 20 types — diagnosis=ICD-10-CM, billingCode=CPT/HCPCS (representative subset), medication=RxNorm, vaccine=CVX, race/ethnicity=OMB, usState=USPS, plus allergen/reaction/severity/language/insurer/marital/sex/pronouns/medForm/medRoute/medFrequency/problemStatus/apptLocation.
- **API /api/refdata**: GET (list/search by type, auth via middleware) + POST (create new value, requires session). Backend tested 9/9 pass.
- **RefSelect component** (src/components/RefSelect.tsx): searchable dropdown + inline "Create new…" box that writes to the catalog and is instantly available. emit=display|code, optional codeName for coded fields.
- **Wired (Phase 2)**: Patient registration (sex, pronouns, language, race, ethnicity, marital status, state, insurer), Allergies (substance, reaction, severity), Problems (ICD-10 diagnosis). Registration API now persists race/ethnicity/maritalStatus.
- **Pending (Phase 3/4)**: wire RefSelect into medications/orders (med name+form+route+frequency), billing/charges (CPT), encounter diagnoses, immunizations (CVX).

## Iteration 4 (Kiosk Mode, PWA, Back-to-Top, transparent header)
- **Transparent landing header**: converted to client LandingHeader — transparent over hero (white logo + light nav) → solid white on scroll (color logo + dark nav); animated underline hovers; button lift effects; header logo made smaller; added "Modo Kiosco" button. Hero gets extra top padding to sit under the fixed header.
- **Back-to-Top**: floating bottom-center arrow (BackToTop.tsx) appears after 500px scroll; hidden on /kiosk.
- **Kiosk Mode** (/kiosk, public): standalone full-screen experience (Fullscreen API) with tabbed UI — ProactiveKIOSK (looping bilingual EN/ES slideshow with dynamic text on advantages, security/privacy, patient & attorney portals; tap to pause -> Kiosk Menu + Exit), Admission & HIPAA (self check-in intake + HIPAA consent + e-signature; ProactiveMed/Physical Rehab module), Patient Portal (opens portal login). Exit closes sessions (logout endpoints), clears storage, leaves fullscreen, returns to /. Global assistant + cookie banner hidden on /kiosk.
- **Kiosk intake API** (POST /api/kiosk/intake, public): creates/reuses Patient (email or name+dob, else new w/ MRN) + writes HIPAA consent Document to chart + front-desk Message. Returns confirmation PC-XXXXXX + MRN. Backend tested (valid, validation 400s, idempotent reuse) — all pass.
- **PWA install**: manifest.webmanifest + sw.js + generated icons (192/512/maskable/apple) + layout metadata (manifest, appleWebApp, themeColor) + PWAController (registers SW, shows Install App button via beforeinstallprompt). Installable as borderless standalone app on Android/Windows.

## Iteration 5 (Documents tab, Kiosk idle reset, in-kiosk portal login, Attorney Portal)
- **Documents tab** on patient chart (/patients/[id]/documents): lists Document records; kiosk HIPAA consent docs are expandable to show module/reason/signature/confirmation. Tab added to PatientHeader.
- **Kiosk idle reset**: 2-minute inactivity returns kiosk to the slideshow and remounts the intake/portal forms (fresh for next patient).
- **In-kiosk Patient Portal login**: Patient Portal tab now signs in with MRN+DOB via /api/portal/auth/login and embeds /portal/dashboard in a same-origin iframe — stays in fullscreen; sign-out returns to the login form.
- **Attorney Portal** (/attorney, public page; own JWT session cookie proactive_attorney_session): attorneys log in (email+access code), submit patient record requests, and download an authorized records bundle once approved. Staff approve/deny at /records-requests (EHR, linked from Settings). Download is gated on approval + patient lastName/MRN match. New Prisma models Attorney + RecordRequest. Seeded attorney: attorney@example.com / PROLAW2025. Backend tested 17/17 pass.

## Iteration 6 (Records PDF, Attorney Admin, Kiosk receipt, Request notifications)
- **Records PDF Export**: attorney download endpoint now returns a branded PDF (pdf-lib) with a navy header band, embedded Proactive Clinic logo, clinic address, and sections (Patient / Problems / Medications / Allergies / Documents) with pagination. Verified application/pdf. Gated on approval + MRN/last-name match.
- **Attorney Admin** (/attorneys, staff; linked from Settings): create attorney logins, show/hide & reset access codes, activate/deactivate. APIs GET/POST /api/attorneys, PATCH /api/attorneys/[id].
- **Kiosk Print Receipt**: kiosk check-in success screen has a "Print receipt" button; a print-only slip (logo, patient, MRN, confirmation, module, date, HIPAA note) prints via window.print() with @media print CSS in globals.css.
- **Request Notifications**: EHR top-bar bell (RecordRequestBell) polls GET /api/records-requests/count every 30s and shows a red pending-count badge linking to /records-requests.

## White-label / Replicable Package (single-tenant)
Goal: make the app easy to re-deploy for a new clinic with a guided, admin-only setup.
- Phase 1a (DONE): `/setup` wizard (admin-gated, re-editable from Settings). Steps: Identity (name/division/tagline/address/phone/email/website), Branding (primary/secondary/accent colors with live preview + header/footer logo upload), Modules (enable/disable EHR, Portal, Kiosk, Legal, Attorney Portal, Pharmacy/POS, AI Assistant), Review & Finish.
  - Dynamic theming: Tailwind `brand-*` wired to CSS variables; `ThemeStyle` injects a palette generated from the chosen primary color at runtime → whole app re-themes from one color. Defaults reproduce Proactive blue.
  - Config stored in AppSetting `site_config` (deep-merged over defaults). Logos/assets stored in Mongo `BrandAsset`, served publicly via `/api/branding/[key]`.
- Phase 1b (TODO): hero + kiosk slide management — use curated defaults, upload, or AI-generate (Gemini Nano Banana via Emergent LLM Key).
- Phase 2 (TODO): portable package — `.env.example`, README with 1-command setup, seed/setup script for Emergent/VSC/Cursor.
- Wiring TODO: propagate `site_config` identity (address/phone/name) to footer, kiosk, PDFs, assistant prompts (currently many are hardcoded / in i18n dictionaries).

## Public Website Scheduling — "Book a Visit" (DONE, backend-tested)
- Public page `/book` (no auth; whitelisted in middleware) with a choice screen:
  - **New Patient**: basic info only, NO MRN field, disclaimer that MRN is created/activated in person at the clinic; priorityCheckin=false.
  - **Current Patient**: requires MRN + DOB (verified against Patient record), richer service list, gets priorityCheckin=true.
- Data model `AppointmentRequest` (prisma) with status pending|confirmed|declined + unique confirmation `PC-XXXXXX`.
- API: `POST /api/appointments/request` (PUBLIC create + existing-patient verify), `GET` (staff list, ?status filter), `PATCH /api/appointments/request/[id]` (staff status update). Backend tested: 12/12 cases pass.
- CTAs wired to `/book`: landing hero, booking band, insurance section, and header "Schedule a Visit" (were `#contact`).
- Staff nav item "Appointment Requests" -> `/appointment-requests` (Confirm/Decline, priority flag).
- Note: used `/book` (not `/schedule`) to avoid conflict with the existing authenticated staff calendar at `/schedule`.

## Intake / Clinical Forms (Physical Recovery & Therapy) — added
- Recreated & rebranded (Proactive Clinic, San Antonio) the supplied Flagler MRI templates into 5 forms:
  new-patient-intake & current-patient-checkin (online + printable), first-office-visit, followup-visit,
  procedure-report (printable clinical docs).
- Single source of truth: src/lib/intake/forms.ts drives BOTH the online UI and the pdf-lib PDF generator (src/lib/intake/pdf.ts).
- Public online intake at /intake (titled/numbered sections + descriptions per form, consent acknowledgements, typed e-signature); submissions create/match a Patient and store a Document (category intake / intake-followup).
- Branded printable PDFs via GET /api/intake/forms/[slug]/pdf (logo, clinic header/footer, checkboxes, extremity tables, signature lines).
- Staff page /intake-forms (nav "Intake Forms") to share online link and print PDFs.
- Backend tested (Iteration 17): forms list, PDF generation for all 5 slugs, submit + validation — all passing.

## Intake enhancements (Iteration 18)
- Spanish/English toggle on /intake (src/lib/intake/i18n.ts) — whole online intake + branded PDFs translate (?lang=es).
- Injury Body Map: tap-to-mark Front/Back silhouettes (src/lib/intake/bodymap.ts); rendered on screen and in PDFs (blank + filled). Part of new-patient-intake and follow-up forms.
- PDF Prefill: renderer draws submitted values (text, X'd checkboxes, yes/no, typed signature, body-map markers, "COMPLETED COPY" badge). Public POST /api/intake/forms/[slug]/pdf returns a filled copy of just-entered data; staff GET /api/intake/submissions/[id]/pdf and portal GET /api/portal/intake/[id]/pdf return stored completed copies.
- Intake Review Inbox (/intake-inbox, staff nav): pending/approved tabs, approve/reopen (status in doc body), completed-PDF/file downloads, and staff upload of offline forms (MRN lookup). APIs under /api/intake/submissions/*.
- Upload/download of offline forms: staff (/api/intake/submissions/upload + /[id]/file) and patient portal (/api/portal/intake/upload + /[id]/file, /[id]/pdf); files stored as base64 in Document.body (≤~6MB, PDF/image). Portal documents page shows download + upload with review status.
- Security: middleware now makes only /api/intake/forms and /api/intake/submit public; /api/intake/submissions/* require staff session; /api/portal/intake/* require portal session with ownership checks. Backend tested (Iteration 18): 24/24 cases passed.

## Intake enhancements (Iteration 19)
- Body Map Legend: markers now carry a pain type (Sharp/Dull/Burning/Numbness/Tingling/Stiffness) with colors. Online picker has a pain-type "pen" + colored numbered markers + legend; PDFs render colored markers, a color key, and a per-point legend.
- Auto-Attach to Chart: approving an online intake copies answers into the patient chart — conditions/otherConditions -> Problems, allergies -> Allergies, currentMedications -> Medications (dedup, idempotent via attachedToChart). Inbox shows a summary of what was added.
- Professional PDF letterhead + footer: logo + address + slogan ("Comprehensive Wellness & Recovery") ribbon; every-page footer with HIPAA privacy/security notice (EN/ES), © copyright, and slogan.
- Staff patient-chart issuance: Documents tab now has an "Intake Forms — Issue, Download & Upload" panel: New / Renew / Duplicate issuance, all blank PDFs (EN/ES), duplicate re-download of on-file completed PDFs & uploaded files, and staff upload for this patient.
- Portal + staff upload/download reused across chart and portal. Backend tested (Iteration 19): 11/11 passed.

## Intake tracks (Iteration 20)
- Sidebar fix: added "Intake Forms" and "Intake Inbox" to the Clinical nav allow-list in Shell.tsx (they existed but were filtered out).
- Segregated intake into two patient tracks + documentation (FormDef.track):
  - CLINICAL (general/wellness): clinical-new-patient (Insurance & Referral, Reason for Visit, Pain & Function, Body Map, Medical History, Financial/AOB, HIPAA NPP, Consent to Eval/Treat) and clinical-checkin.
  - PERSONAL INJURY (auto/PIP): new-patient-intake (now titled "Personal Injury — New Patient Intake"; added Auto Insurance & PIP section + Assignment of Benefits, Letter of Protection, PIP Disclosure consents) and current-patient-checkin.
  - DOCUMENTATION: first-office-visit, followup-visit, procedure-report.
- Grouped by track on: public /intake landing, staff /intake-forms, patient chart panel (New-Clinical / New-PI / Renew Clinical+PI / Duplicate), inbox + portal upload option lists.
- Full EN/ES for new strings. All 7 forms render EN+ES PDFs with letterhead + HIPAA footer. Backend tested (Iteration 20): all passed (auto-attach still works on clinical form).

## Patient management + PWA (Iteration 21)
- Patient API /api/patients/[id]: GET, PATCH (edit demographics + archive/reactivate via status), DELETE (hard, cascades children). Role gates: edit -> admin/provider/nurse/frontdesk; status -> admin/frontdesk/provider; delete -> admin only. Backend tested 7/7.
- Demographics page: "Manage Patient" panel (PatientManage.tsx) with Edit form, Archive/Reactivate, and admin-only Delete (double confirm). Read-only notice for billing.
- PWA install reactivated + broadened (PWAController): always-visible Install button; native beforeinstallprompt for Android/Chrome/Edge + Windows; bilingual (EN/ES) instruction modal for iPhone/iPad Safari (Add to Home Screen) and Mac Safari (Add to Dock); Chrome/Edge desktop hint. Skipped on /kiosk and when already installed.

## Registration eligibility + Prior Auth (Iteration 29)
- New-patient registration (patients/new) now has a two-column layout: left = form, right = live panels.
- Insurance section adds a Payer directory dropdown (from Billing → Payers), an editable Stedi payer ID field, and a "Verify coverage" button that runs a real-time Stedi eligibility (270/271) check on the entered (not-yet-saved) insurance data.
- Right "Coverage & benefits" pane shows status (active/inactive/error), payer/plan, member ID, and benefit summary (copay/coinsurance/deductible/out-of-pocket). The pre-save check is auto-attached to the patient after creation (PATCH /api/stedi/eligibility {checkId, patientId}).
- Right "Prior authorization" pane = MANUAL tracker (new PriorAuthRequest model + /api/prior-auth CRUD). NOT electronic 278 submission — Stedi's integrated path does not expose self-service PA. Draft entered at registration is linked to the patient on save.
- Backend tested 17/17 (prior-auth CRUD + eligibility attach). UI verified via screenshot.

## Coverage card + Re-verify + Copay prefill (Iteration 30)
- Chart header (PatientHeader) now shows a compact Coverage card (PatientCoverage.tsx) with the latest saved eligibility: status badge, payer/plan, copay, "as of" date. Flags coverage that is inactive/error (rose) or stale >30 days (amber). Appears on every patient chart tab.
- One-click "Re-verify" re-runs a live Stedi eligibility check for the patient (reuses last check's payer + patient insurance) via existing POST /api/stedi/eligibility.
- Schedule "$ Copay" quick button now prefills the exact verified copay from the patient's latest ACTIVE eligibility check (src/lib/coverage.ts getCopayMap) and shows the amount in the button label (e.g. "$ Copay 25").
- No new backend endpoints (reuses tested eligibility routes). Verified via screenshots + DOM assertion. Preview only — redeploy to confirm in production.

## Check-in auto-eligibility + Balance badge + Eligibility worklist (Iteration 31)
- NEW POST /api/appointments/[id]/checkin: sets appointment status to "checked-in" and best-effort runs+saves a Stedi eligibility check (reuses patient's last payer or defaultPayerId; skips silently if Stedi unconfigured/no payer). Backend tested 4/4.
- Schedule appointment cards now have a "Check in" button (CheckInButton.tsx) that triggers the above and refreshes, plus a rose "Bal $X" outstanding-balance badge (src/lib/balances.ts getBalanceMap from patient ledger).
- NEW billing page /billing/eligibility-report: daily worklist of appointments whose coverage is lapsed/unverified/stale (src/lib/coverage.ts getLatestCoverageMap + classifyCoverage), with summary stats and per-row Re-verify (ReverifyButton.tsx). Linked from Billing page ("Eligibility worklist →").
- Verified via screenshots. Preview only — redeploy to confirm in production.

## Insurance edit in chart + eligibility payer fallback (Iteration 32)
- Added Patient.payerId (Stedi trading-partner id). PATCH /api/patients/[id] accepts payerId (role-gated).
- Patient chart Insurance card is now inline-editable (InsuranceCard.tsx): insurer, plan, member ID, group #, Stedi payer ID, plus a payer-directory picker that fills name + ID. Also added Stedi Payer ID to the full Manage Patient editor.
- Eligibility now resolves the payer as: explicit payerId -> patient.payerId -> Settings default -> ANY available active directory payer (supportsEligibility, stediId set). Same fallback added to the appointment check-in auto-eligibility. Clear 400 only when truly no payer exists anywhere.
- Backend tested 7/7; chart edit verified via screenshots. Preview only — redeploy to confirm in production.

## Owner-admin recovery (Iteration 31b)
- Self-healing owner admin on every production boot (scripts/ensure-owner-admin.cjs via start.js) from OWNER_ADMIN_EMAIL/OWNER_ADMIN_PASSWORD; idempotent + non-destructive.
- seed.ts destructive wipe now gated behind SEED_RESET=true so a reseed can never nuke a populated DB. Restored ernesto@210codelabs.com in preview.
