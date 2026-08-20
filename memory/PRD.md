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

## Payer autofill + Coverage history + Change password (Iteration 33)
- PayerAutocomplete.tsx: typeahead on insurer/payer fields that live-searches Stedi payers (falls back to local directory) and fills payer name + Stedi payer ID. Wired into InsuranceCard (chart) and NewPatientForm.
- CoverageHistory.tsx: per-patient eligibility timeline on Demographics, with "changed from <status>" badges flagging when coverage status changed. Uses existing GET /api/stedi/eligibility?patientId=.
- Self-service password change: POST /api/auth/change-password (bcrypt verify current + update), /settings/password page + ChangePasswordForm, card on Settings, lock icon in Shell header. Backend 8/8. Rejects demo-only sessions, wrong current pw, <8 char new pw.
- Note: test restored billing@ DB password to apex123! (endpoint enforces 8-char min); apex123 still works via demo fallback.

## Schedule Day/Week/Month/Staff views + chart booking (Iteration 34 — Phase 1)
- /schedule now has a Day/Week/Month/Staff view toggle (WEEK is default). Week = 7-day columns with appt chips; Month = calendar grid with chips + "+N more"; Day = rich time grid (keeps Check-in/Copay/Balance); Staff = per-provider columns for the day. Prev/Today/Next step by day/week/month per view. Provider filter + New Appointment preserved.
- Appointments API rewritten (/api/appointments): GET (?patientId/from/to/providerId returns {appointments, providers, services}); PATCH now supports reschedule (day+time/startsAt, provider, service, reason, notes, location) and status (check-in/cancel/complete), recomputing endsAt.
- Patient chart summary: new PatientAppointments.tsx replaces the read-only upcoming card — book / modify (reschedule) / cancel directly from the Doctor's view, role-gated.
- Backend 10/10 passed; all views + chart booking screenshot-verified. Preview only — redeploy to confirm in production.
- PHASE 2 (pending): patient-portal appointment view + request/cancel via the existing appointment-request approval flow.

## Phase A — Stedi PRODUCTION wiring + Superbill AI + claim scrubber (Iteration 35)
- Stedi activated in PRODUCTION mode: prod API key stored in integrations AppSetting (env=production, enabled); added STEDI_ENVIRONMENT env fallback in getStediConfig. Payer directory verified HTTP 200 with prod key. Billing card shows Connected · PRODUCTION/TEST badge.
- NEW POST /api/billing/ai-coding (GPT-4o via emergentintegrations): reviews CPT/ICD linkage vs clinical note, suggests codes/modifiers, flags medical-necessity issues, returns cleanClaimReady. Backend tested.
- NEW POST /api/billing/scrub: deterministic clean-claim validation (billing NPI/TaxID/taxonomy from Stedi config + per-claim member/payer/CPT/ICD format + POS + env). Backend tested.
- Billing page: added "Superbill AI assistant & claim scrubber" card (AiCodingAssistant.tsx).
- ⚠️ WARNING: Stedi is PRODUCTION in PREVIEW DB now — real 837 claim submission from preview would send REAL claims. Eligibility (270/271) is read-only/safe.
- REMAINING PHASES (not started): B Bank/EFT config + payer EFT enrollment forms; C sidebar/nav restructure w/ submenus; D intake forms rebuild (Clinical + PT, branded PDFs, body/pain diagram, HIPAA, deep research); E Kiosk mode w/ temp ID + secure send.

## Phase B (Bank/EFT) + Phase C (sidebar submenus) — Iteration 36
- Phase B: new BankAccount + PayerEftEnrollment models. APIs /api/billing/bank-accounts and /api/billing/eft-enrollments (admin/billing only). Routing/account numbers stored server-side, returned MASKED (last4) only. New page /billing/bank-eft (BankEft.tsx) manages bank accounts + per-payer EFT/ERA enrollment status. ERA remittances already auto-reconcile to ledger. Backend 10/10.
- Phase C: Shell sidebar now uses collapsible submenus. Billing → Overview, Eligibility worklist, Revenue Cycle, Bank & EFT. Intake → Intake Forms, Intake Inbox. Parent highlights/expands when any child route is active.
- REMAINING: Phase D intake forms rebuild (Clinical + PT, branded fillable PDFs, body/pain diagram, HIPAA, deep research); Phase E Kiosk mode (temp ID + secure send from chart).

## Admin Data Tools + EMR Data Import (Iteration 37) — top priority feature
- New Admin tab "Data Tools" (/admin/data-tools). Backup, Restore, Reindex, Integrity-scan moved/consolidated here (full repair remains on /admin/database).
- EMR DATA IMPORT (patients): sources Practice Fusion, eClinicalWorks (eCW), Generic CSV. Upload/paste CSV -> Preview (auto-maps headers via broad alias map, normalizes DOB & sex, shows sample + counts + missing-required) -> Import (creates patients, dedupe by MRN or name+DOB, additive/never overwrites). ImportJob model tracks runs; recent imports table shown.
- APIs (admin-only via requireAdminSession): POST /api/admin/import/preview, POST/GET /api/admin/import/commit. lib: src/lib/import/emr.ts (RFC-4180 CSV parser + mapping).
- Backend 7/7 passed (auth, mapping, DOB normalization MM/DD/YYYY->ISO, dedupe skip-on-rerun, job history, search verify). UI screenshot-verified. Cleaned test patients from preview.
- NOTE: Practice Fusion / eCW import is FILE-BASED (their CSV/demographics export) — not a live vendor API pull (that needs partner OAuth/BAAs). C-CDA/FHIR import is a future enhancement.

## EMR Import enhancements — Column Remap + Appointment Import + C-CDA/FHIR (Iteration 38)
User picked these three from the import backlog (order 1→2→3, each backend-tested). All admin-only, additive & non-destructive, preview-then-commit.
- FEATURE 1 — Column Remap UI: /api/admin/import/preview now accepts an optional `mapping` override {field:columnIndex} (used instead of auto-detect) and returns raw `sampleRows`. DataTools patient import shows editable per-field dropdowns (or "— ignore —") with a live sample and a "Reset to auto-detected" link; corrected mapping is passed to commit. Backend 4/4.
- FEATURE 2 — Appointment Import: new entity toggle Patients | Appointments | Clinical in Data Tools. AppointmentImport.tsx + /api/admin/import/appointments/preview & /commit. Schedule CSV auto-maps patient (MRN or name+DOB), date/time (or combined startsAt), provider (NPI/name), service (code/name), duration, status, reason, location. Matches EXISTING patients only (unmatched rows SKIPPED — never creates patients). Provider matched by NPI/name, falls back to a UI-selected default provider. endsAt = start + (row/service/45min). Dedupe by patient+exact startsAt. Records ImportJob entity='appointments'. Backend 6/7 (1 miss was an unrelated patient-search quirk; importer matches by MRN directly).
- FEATURE 3 — Clinical Import (C-CDA XML / FHIR JSON): ClinicalImport.tsx + /api/admin/import/clinical/preview & /commit. Auto-detects format ('<' => C-CDA, '{' => FHIR bundle). Extracts demographics + Problems (with ICD-10 when present) + Medications + Allergies. Commit matches existing chart (MRN, else name+DOB) or CREATES a new chart, then attaches deduped records; idempotent on re-run. Records ImportJob entity='clinical'. Uses fast-xml-parser. Fixtures: test_fixtures/sample_ccda.xml, sample_fhir.json. Backend 6/7 then idempotency fix verified 4/4 (fixed Prisma insensitive-equals building an UNESCAPED MongoDB regex that broke dedupe for values with special chars like "Essential (primary) hypertension" — now preloads existing records and compares in JS).
- Data Tools "Recent imports" table now shows a Type column (patients/appointments/clinical). No Prisma schema change beyond reusing existing models. UI screenshot-verified (3 tabs + FHIR preview rendering demographics + clinical lists). Preview only — redeploy to confirm in production.
- LIMITATIONS: C-CDA/FHIR parsing is best-effort across common export layouts; unusual vendor variants may need mapping tweaks with a sanitized sample. Imported clinical data must be clinician-reviewed before it is relied upon.
- STILL PENDING from broader roadmap: Phase D intake forms rebuild (Clinical + PT, branded PDFs, body/pain diagram, HIPAA); Phase E Kiosk (temp ID + secure send).

## Clinical Import — Vitals & Immunizations (Iteration 39)
- Extended the C-CDA/FHIR clinical importer (Feature 3) to ALSO bring across Vital signs and Immunization history, alongside demographics + problems + meds + allergies.
- C-CDA: Vital Signs section (LOINC 8716-3) -> one Vital per organizer (LOINC->field map: height 8302-2, weight 29463-7/3141-9, BMI 39156-5, systolic 8480-6, diastolic 8462-4, pulse 8867-4, temp 8310-5, resp 9279-1, SpO2 2708-6/59408-5, pain 38208-5); Immunizations section (LOINC 11369-6) -> vaccine/CVX code/givenAt/lot.
- FHIR: Observation resources (vital-signs, incl. BP panel via component[]) grouped by effectiveDateTime into one Vital each; Immunization resources -> vaccine/CVX/occurrence/lot/site.
- Unit conversions handled: lb->kg, degF->degC, inch->cm.
- preview now returns counts.vitals + counts.immunizations + lists; commit attaches Vital + Immunization records, deduped & idempotent (vitals by takenAt+values signature; immunizations by cvx/vaccine+date). ImportJob entity='clinical'. No Prisma schema change (reuses Vital + Immunization models).
- Fixtures updated (sample_ccda.xml: 1 vital + 2 immunizations; sample_fhir.json: 1 vital + 1 immunization). Backend 6/6 incl. unit conversions + 100% idempotency. UI (ClinicalImport) now shows 5 categories: Problems, Medications, Allergies, Vitals, Immunizations — screenshot-verified. Preview only — redeploy to confirm in production.

## Clinical Import — Encounters/Notes (3c) + Live SMART-on-FHIR Connector (Iteration 40)
- ENCOUNTERS/NOTES (Feature 3c): clinical importer now also extracts visit history + notes. C-CDA Encounters section (LOINC 46240-8) and FHIR Encounter + DocumentReference/Composition resources -> Encounter rows (status='signed', noteFormat='simple', simpleBody=note, chiefComplaint=reason, encounterTypeName=type). Each encounter matched to a provider by NPI/name, else falls back to a UI-selected default provider (encounters without a provider are skipped with a notice). Deduped by startedAt+type+note-prefix; idempotent. Refactored persist logic into shared src/lib/import/persist.ts (persistExtracted) reused by BOTH file importer and live importer; extractFromFhirResources() added for resource-array normalization. Backend A1-A7 passed.
- LIVE CONNECTOR (Feature 4): real SMART-on-FHIR (authorization_code + PKCE) connector for Practice Fusion (Veradigm) + eClinicalWorks, NOT credential impersonation/scraping. New Prisma model FhirConnection (per-provider OAuth config + tokens; secrets/tokens ALWAYS masked in API responses). Routes: GET/POST /api/admin/fhir/connections; GET /api/admin/fhir/[provider]/authorize (302 to vendor w/ PKCE+state); GET .../callback (code exchange, state validation); POST .../import (search patient -> fetchPatientEverything -> extractFromFhirResources -> persistExtracted); POST .../disconnect. New 4th Data Tools tab "Connected (live API)" (FhirConnect.tsx): per-vendor config form, redirect URI to register, Connect/Disconnect, and a patient search+import panel. Backend B1-B12 passed incl. secret-masking + PKCE authorize + guards.
- STATUS: connector is INERT until the practice completes each vendor's developer-program onboarding and supplies approved OAuth credentials (client id/secret, FHIR base URL, auth/token URLs, scopes) + BAA. No mock data. Live token exchange + FHIR fetch cannot be tested until real/sandbox creds are provided. Veradigm has a sandbox; eCW has no reliable public sandbox. Preview-only; redeploy to confirm in production.
- NEEDED FROM USER (per vendor) before live import works: FHIR base URL, Authorization URL, Token URL, Client ID (+ Client Secret if confidential), approved scopes, registered Redirect URI (shown in UI), and a signed BAA.


## Directory Search (Feature 6) + Bulk Patient Import (Feature 7)
- DIRECTORY SEARCH (Feature 6): admin-only GET /api/admin/fhir/directory?q=... searches a bundled Practice Fusion Service Base URL directory (3398 practices, parsed from the user-uploaded ServiceBaseURLs.json) by name/NPI/org id/city and returns the Provider/System Access FHIR base URL (pattern https://api.practicefusion.com/fhir/r4/v1/{orgId}). Wired into the Veradigm card as a "Find your practice" search that auto-fills the FHIR base URL. Backend 5/5. UI verified end-to-end (login -> data-tools -> Connected tab -> search -> results render with "use" buttons); the prior fork's "screenshot failure" was an automation-timing artifact, not an app bug.

## SMART Backend Services / System Access + Bulk Data $export (Feature 8) — the REAL Practice Fusion live-connection mechanism
- Adds an unattended "System access" mode alongside the interactive provider-login (authorization_code + PKCE) mode. This is the "Provider/System Access" path Practice Fusion (Veradigm) documents for practice-level migration + Bulk Data.
- FLOW (no user login, no clinician password): the app generates a per-connection RSA (RS384) signing key (private stored server-side, NEVER returned; public served at a PUBLIC JWKS endpoint the vendor registers) → mints a signed-JWT client assertion → OAuth client_credentials grant → system access token → Bulk Data $export (kickoff 202 → poll manifest → download NDJSON → group per patient → persist via the SAME extractFromFhirResources + persistExtracted engine, with live FhirBulkJob progress).
- FILES: prisma FhirConnection gained authMode/privateJwk/publicJwk/keyId/jwkAlg; src/lib/fhir/backend.ts (generateSigningKey, getSystemToken, getValidToken dispatcher, kickoffExport w/ _type fallback, pollExport, downloadManifest, groupByPatient); src/lib/fhir/bulk.ts branches system($export) vs user(search+per-patient); connections POST accepts authMode + generates/preserves the key; NEW PUBLIC GET /api/fhir/jwks/[provider] (allow-listed in middleware); NEW POST /api/admin/fhir/[provider]/system/test; bulk-import + single-import guards accept system mode; FhirConnect UI got an auth-mode toggle + system fields + JWKS URL + Generate/Regenerate key + Test system connection.
- TESTED: backend 8/8 passed incl. a REAL live round-trip against the official SMART Bulk Data reference server (bulk-data.smarthealthit.org): register JWKS -> client_id -> signed RS384 assertion -> client_credentials token (scope system/*.read) -> $export -> imported 3 patients + 126 clinical records. System Access UI render verified via Playwright. All test data cleaned.
- GO-LIVE (Practice Fusion): user registers a Veradigm "System/Bulk export" R4 app at developer.veradigm.com, pastes our JWKS URL, requests system/*.read scopes, and provides: org-specific Provider/System Access base URL, the issued Client ID, and confirms customer activation + any BAA/DUA. Then enter base URL + Client ID in System access mode, Test, and Pull all patients. The reference server proved the protocol; only vendor credentials/activation remain.
- BULK PATIENT IMPORT (Feature 7): admin-only "pull EVERY patient" migration from a CONNECTED EHR over its FHIR API, with live progress. New Prisma model FhirBulkJob (progress tracker; all fields non-sensitive). New client helpers countPatients() + iteratePatients() (async generator paging all Patients via Bundle next links). Background worker src/lib/fhir/bulk.ts (runBulkImport) pages patients, and per-patient fetchPatientEverything -> extractFromFhirResources -> persistExtracted (SAME idempotent engine as file/single importers), updating the job row after each patient. Routes: POST /api/admin/fhir/[provider]/bulk-import (start; body {limit? for a trial run, defaultProviderId?}), GET (poll latest/by jobId), DELETE ?jobId (cooperative cancel). Guards: 401/unknown provider/not configured/not connected/409 one-run-per-provider/invalid limit. FhirConnect UI: "Bulk import — pull every patient" panel (shown only when connected) with trial-run limit, default-provider picker, live progress bar + counts (processed/total, new charts, merged, records added/skipped, failed), current patient, Cancel, errors accordion; resumes polling across reloads. Backend 11/11 passed incl. a LIVE trial run against the open SMART sandbox (r4.smarthealthit.org: 3 patients -> 3 charts + 95 clinical records in ~8s) and cooperative cancel; all test data cleaned. UI render verified via Playwright. Runs in the long-lived Next server process (detached worker). STILL requires vendor-approved OAuth creds to run against a real Practice Fusion/eCW practice (see Feature 4 needs).
## Iteration — Stedi RCM Expansion (Aug 2026, preview)
User request: build Prior Auth (278), Claim Status (276/277), ERA/835 auto-posting, Payer enrollment — in that order, non-stop — and enhance layout/access/edit/save across billing modules.

Delivered (preview; backend agent-tested 3/3 task groups PASS; UI screenshot-verified; NOT user/production confirmed):
- Prior Auth: Stedi has NO 278 REST endpoint (playbook-confirmed). Kept manual tracker (/api/prior-auth) + NEW /api/prior-auth/check-required that derives authRequired from 270/271 benefitsInformation[].authOrCertIndicator (extractAuthRequired). New "Prior Auth" tab (patient search, full CRUD, "Check if required").
- Claim Status: /api/stedi/claims/[id]/status now normalizes 277 (normalizeClaimStatus), appends Claim.statusHistory[] (cap 50), sets statusCategory, advances status on definitive results. Claims tab shows category + expandable history.
- ERA/835: NEW public POST /api/stedi/webhook (middleware public), shared-secret header x-stedi-webhook-secret vs Stedi WEBHOOK_SECRET; idempotent StediEvent; shared ingestEra835() (src/lib/era.ts) used by webhook + polling; auto-posts payment ledger entries. Remittances tab shows webhook status + copyable setup. Added WEBHOOK_SECRET field to Stedi integration catalog.
- Enrollment: API unchanged; UI adds lifecycle badges + Refresh-all.
- Schema: Claim.statusHistory/statusCategory, PriorAuthRequest.authRequired/authRequiredRaw/lastCheckedAt, new StediEvent model. prisma db push applied in preview.
Pending: user redeploy to production; configure ERA webhook secret + Stedi webhook binding for real-time 835.

## Iteration — Calendar drag in all views + daily timeslots (Aug 2026, preview)
User request: "enable dragging in all calendar views (day/week/month) for appointment scheduling/booking; show timeslots in daily for easy setting and changing."
Delivered (FRONTEND ONLY — reuses the already-tested PATCH /api/appointments; NO backend/schema changes):
- NEW client components under src/app/(app)/schedule/: DayCalendar.tsx (9AM–8PM CT timeslot grid; drag appt between slots to change TIME; click an empty slot → opens New Appointment prefilled to that time via a `schedule:new-appt` window event; keeps Check-in/Copay), WeekCalendar.tsx (7 day columns; drag appt to another day to reschedule, time preserved), StaffDayCalendar.tsx (per-provider timeslot columns; drag vertically to change time AND across columns to reassign provider).
- Shared plain module src/app/(app)/schedule/reschedule.ts: CalAppt type, patchAppointment() helper, grid constants (GRID_START_HOUR/GRID_SLOTS/SLOT_PX), buildSlotList(), STATUS_DOT. (NOT a "use client" module, so the server page can import types/constants safely.)
- schedule/page.tsx: server now computes each appt's top/height/labels/dayKey/timeHHmm in Central (TZ pinned) and passes serializable CalAppt[] to the client views, so drag positioning is correct regardless of browser TZ. Old server DayGrid/StaffGrid/WeekView removed. Month view (MonthCalendar) unchanged (already draggable).
- NewApptButton.tsx: listens for `schedule:new-appt` to open prefilled at a clicked slot.
- Reschedule always calls PATCH /api/appointments {id, day, time, providerId?} which preserves duration and hard-enforces 9AM–8PM CT clinic hours (rejections surface as an error toast + optimistic revert).
- Verified via authenticated Playwright screenshots: Day (timeslots + 2 Adams appts at 9:30/11:15), Week (7 columns, Tue 25 shows both), Staff (provider columns w/ appts). Type-clean (same 8 pre-existing baseline errors only). Preview-only; redeploy for production.

## Iteration — Landing page repositioned as ProactiveClinics platform (Aug 2026, preview)
User request: rewrite ALL landing content to position ProactiveClinics as an all-in-one EHR/EMR + AI healthcare operating platform (unified clinical/financial/administrative/patient/interoperability workflows). Value prop "One Platform. Every Workflow. Better Outcomes." Brand "ProactiveClinics — Unified Healthcare Intelligence".
Delivered (FRONTEND ONLY — content driven by the i18n dictionary; all interactive functionality preserved: patient portal + staff login card, language toggle, Install App, kiosk, book/demo links):
- src/lib/i18n/dictionaries.ts: fully rewrote the EN + ES `landing` blocks (kept every key so unused compiled sections still typecheck). Hero = "One Platform. Every Workflow." / "Better Outcomes." + "ProactiveClinics — Unified Healthcare Intelligence" + platform description. 6 capability cards (Clinical & Charting, AI Assistance, Billing & RCM, Credentialing & Enterprise, Attorney/PI Workflows, Interoperability & Data Exchange). 4 "Why" reasons (One Unified Stack, Patient Engagement, Analytics & Insights, Built to Scale). Testimonials reworded to practice roles. Contact repositioned (Get Started / Talk to Our Team / Headquarters / Support Hours / demo CTA). Footer + nav (Platform/Why/Testimonials/Contact) updated. clinicName → "ProactiveClinics". scheduleVisit → "Request a Demo".
- src/app/page.tsx: hero trust chips now platform-focused (FHIR·HL7·C-CDA, AI-assisted clinician-in-control, Proactive UMS ecosystem); removed the video-call overlay on the 6th service card.
- src/components/HeroAuth.tsx: badge → "Unified Healthcare Platform".
- Verified via screenshot (EN). Type-clean (same 8 baseline errors). Preview-only; redeploy for production. Note: page images/logos are existing clinic assets (unchanged); only copy was rewritten.

## Iteration — Conflict-free dragging + Recurring visits (Aug 2026, preview)
User request (selected next-actions): (1) flag clashes live while dragging so double-booking is caught before it happens; (2) let staff create a repeating series of appointments in a couple of clicks.
Delivered:
- CONFLICT DETECTION (backend, agent-tested 8/8): NEW src/lib/appointments.ts findConflict(providerId,start,end,excludeId?) — overlap query excluding cancelled/no-show. Wired into POST + PATCH /api/appointments: overlapping appts for the SAME provider now return 409 {conflict:true} (create/reschedule/reassign). Cancelled/no-show don't block; a different provider at the same time is fine; clinic-hours stays 400.
- CONFLICT-FREE DRAGGING (frontend): Day/Week/Staff calendars compute the target provider's busy intervals live during a drag and tint slots green (open) / red (clash), color the drop indicator green/red, and BLOCK a clashing drop with an explanatory toast (plus the 409 server guard as backstop). Added durationMin to CalAppt + slotIsFree/hasOverlap/toMin helpers in reschedule.ts.
- RECURRING VISITS (backend, agent-tested 6/6): NEW POST /api/appointments/recurring {patientId,providerId,serviceTypeId?,day,time,reason?,location?,notes?,frequency,count} — daily|weekly|biweekly|monthly, count 2..26; builds the series, skips dates outside 9AM-8PM CT or that would double-book, creates the rest; returns {created,skipped,total,details}. Idempotent (re-running a series = all skipped).
- RECURRING UI (frontend): NewApptButton got a Repeat select + Occurrences input + live hint; the Schedule button becomes "Schedule N visits"; POST 409s (single) and series results (created/skipped) surface as inline banners. Verified via screenshot ("Every 2 weeks", 4 occurrences, "Schedule 4 visits").
Type-clean (same 8 baseline errors). No schema change. Preview-only; redeploy for production. NOTE: double-booking is HARD-BLOCKED on create + drag (clinics wanting intentional overbooking would need an override — not built).

## Iteration — Premium landing icons/emblems (Aug 2026, preview)
User request: replace flat "colored square" icon tiles with top-grade premium styling + official/standard emblems where they fit.
Delivered (FRONTEND ONLY, page.tsx + HeroAuth.tsx; lucide NOT added — reused inline SVG paths):
- Added a shared SVG linearGradient (#pcIconGrad, brand-600 -> brand-700 -> red-600) and a reusable <Emblem> tile: glassy white, layered soft shadow, thin ring + inner highlight, subtle brand/red gradient underlay, gradient-STROKED icon. Applied to Services (6), Why (4), and Contact (3) cards — replacing solid ACCENTS.circle colored squares.
- Swapped SERVICE_ICONS + Why icons to glyphs that FIT the platform capabilities (clipboard-check, sparkles, card, verified-shield, scales, share/network; layers, people, line-chart, building).
- NEW <StandardsStrip>: premium glass wordmark pills for open healthcare standards — FHIR R4, HL7 v2.x, C-CDA, X12 EDI (837/835/270), SMART on FHIR, ICD-10, CPT/HCPCS, NPI/NPPES (rendered between Services and Why).
- Hero trust chips (HeroAuth): flat colored squares -> premium glass rounded pills with distinct meaningful icons (interoperability/share, AI/sparkles, ecosystem/layers).
- Testimonials avatar -> brand->red gradient with white ring. Service-card top accent bar unified to a single brand->red premium gradient.
Type-clean (same 8 baseline errors). Verified via screenshots (hero chips, services+standards, why). Preview-only; redeploy to publish to production (proactiveclinics.com).

## Iteration — Topic-matched Platform card images (Aug 2026, preview)
User request: replace the generic photos in the "THE PLATFORM" section (6 capability cards) with images that match each card's title/topic.
Delivered (FRONTEND ONLY): SERVICE_IMAGES in src/app/page.tsx swapped from /svc-1..6.jpg to 6 topic-relevant stock photos (Unsplash/Pexels, sourced via vision_expert), in the exact card order: Clinical & Charting (EHR laptop+stethoscope), AI Assistance (robot+human hand on digital interface), Billing & Revenue Cycle (stethoscope on calculator), Credentialing & Enterprise (business team meeting), Attorney/PI (law office), Interoperability & Data Exchange (abstract data network). Plain <img loading="lazy"> so no next.config domains needed. Verified via screenshots (both rows). NOTE: images are REMOTE URLs — for production reliability they could be downloaded into /public later. Preview-only; redeploy to publish to proactiveclinics.com.

## Iteration — Mobile landing header (hamburger + always-visible Kiosk) (Aug 2026, preview)
User request: on mobile use a hamburger menu; keep the Kiosk-mode button always visible on the topbar (kiosks are large tablets); remove Attorney Portal from the topbar and put it in the hamburger dropdown.
Delivered (FRONTEND ONLY, src/components/LandingHeader.tsx):
- Added a hamburger toggle (md:hidden) + a mobile dropdown panel containing the nav links (Platform/Why/Testimonials/Contact/Guide) + the Attorney Portal button + Language switcher + Install App. Panel closes on link tap and auto-closes when resized to >=768px.
- New `solid = scrolled || menuOpen` so opening the menu over the transparent hero switches the bar to solid white (color logo + dark controls) for legibility.
- Kiosk ("Modo Kiosco") button changed from `hidden lg:inline-flex` to ALWAYS visible: icon-only on phones (<640px), icon+label on sm+.
- Language switcher + Install App are hidden on the mobile topbar (md:block) and surfaced inside the hamburger instead; Book/Request-a-Demo stays on the bar at all sizes.
- Desktop (md+) unchanged: full nav incl. Attorney Portal, lang, install, kiosk (now labeled from md up), Book. Type-clean; verified via 414px screenshots. Preview-only; redeploy to publish.

## Iteration — Mobile menu polish + baked Platform images (Aug 2026, preview)
User-selected enhancements (FRONTEND ONLY):
- SLIDE/FADE: mobile dropdown in LandingHeader.tsx is now always-rendered and animated via grid-rows-[0fr]→[1fr] + opacity + a small -translate-y, transition duration-300 ease-out (smooth slide-down + fade on open/close; collapses fully when closed with pointer-events-none + aria-hidden).
- TAP-OUTSIDE CLOSE: added a document mousedown/touchstart listener (active only while open) using a headerRef — clicking/tapping anywhere outside the header closes the menu; Escape also closes it.
- BAKED IMAGES: downloaded the 6 Platform card images into /public (platform-clinical/ai/billing/credentialing/attorney/interop.jpg, valid JPEGs) and pointed SERVICE_IMAGES at the local paths, so they load from our own domain instead of Unsplash/Pexels CDNs. Verified HEAD /platform-clinical.jpg -> 200 image/jpeg.
Type-clean (same 8 baseline errors). Verified via 414px screenshots (open menu, tap-outside close). Preview-only; redeploy to publish to proactiveclinics.com.

## Iteration — User Guide updated for new scheduling features (Aug 2026, preview)
User request: update the online User Guide + PDF with the newest enhancements.
Delivered (content-only, src/lib/guide/content.ts — feeds BOTH the web guide at /guide/[slug] and the PDF at /api/guide/pdf):
- Expanded the "Scheduling & Calendar" section: updated summary; added the optional Repeat step to New Appointment; new "Repeating visits" (Daily/Weekly/Every-2-weeks/Monthly, 2–26 occurrences, auto-skip of out-of-hours/clashing dates); new "Reschedule by dragging (every view)" describing Day (time), Week/Month (day), Staff (time + reassign provider); a tip on the green/red conflict coloring + blocked double-booking; and "Manage the day (Day view)" incl. click-an-empty-slot-to-create. Reused existing schedule.png / schedule-day.png shots.
Verified: /guide/scheduling renders all new content; /api/guide/pdf returns application/pdf (~2.1 MB, valid %PDF- header). No renderer/route changes. Preview-only; redeploy to publish to proactiveclinics.com.

## Iteration — Custom PWA install icon (Aug 2026, preview)
User request: use the attached spine + heart (ECG) + red-cross + green-laurel emblem as the app icon when installing on Android / Windows desktop.
Delivered (static assets only — no code changes; manifest.webmanifest + layout.tsx metadata already point at these filenames):
- Regenerated from the emblem (source 500x481 on black): /public/icon-192.png, /public/icon-512.png (purpose "any"), /public/icon-maskable-512.png (Android adaptive, emblem scaled to ~74% safe-zone so the circular/squircle mask won't clip the laurel), /public/apple-touch-icon.png (180), and /public/favicon.ico (16/32/48/64). All on a black canvas that blends with the emblem's own dark background.
- Trimmed near-black borders (bbox 372x406) then centered; "any" tiles fill ~90%.
Verified: all assets serve 200 with correct content-types (image/png, image/x-icon, application/manifest+json) on localhost:3000; visually inspected 512 + maskable. Preview-only; user must redeploy to publish to proactiveclinics.com, then re-install the PWA (Android/Windows cache the old icon until reinstall).

## Iteration — Big feature batch: Stedi on-demand, drug DB search, inventory editor, specialties, prior-record import (Aug 2026, preview)
User request (all): make Stedi eligibility on-demand + once-per-30-days; pharmacy/drug search everywhere list ALL results with filters + per-page 25/50/100 and combine public DBs; check Medicare/Medicaid via CMS Blue Button; import prior meds/allergies/immunizations from national networks; add inventory category + product editor with image upload; add Clinical → Specialties with provider + patient linking.

Delivered (backend agent-tested 6/6; pages render 200 w/ new UI; PREVIEW only — redeploy to publish):
1. STEDI ELIGIBILITY = ON-DEMAND + 30-DAY CACHE. POST /api/stedi/eligibility now skips a live check (returns cached:true) when a successful (active) check exists <30 days for the patient, unless force:true. Check-in (POST /api/appointments/[id]/checkin) NO LONGER auto-verifies — it returns the latest saved coverage + a note. UI: EligibilityChecker got a "Force re-check" toggle + cached banner; ReverifyButton sends force:true. Helpers in src/lib/coverage.ts (getReusableCheck, daysSince, ELIGIBILITY_MIN_INTERVAL_DAYS=30).
2. FULL DRUG DB SEARCH. GET /api/drugs/search adds a paginated mode (pageSize 25/50/100, page, filters form/route/schedule/productType) returning {results,total,totalPages,rxnorm,...} via openFDA limit+skip+meta.total, merged with RxNorm/RxNav (page 1). Typeahead mode unchanged. New reusable <DrugDatabaseSearch/> embedded on Pharmacy + Inventory (and reused inside the product editor for prefill).
3. INVENTORY CATEGORY + PRODUCT EDITOR + IMAGE UPLOAD. New APIs: POST/PATCH/DELETE /api/inventory[/id], GET/POST /api/inventory/categories + [id]. Image storage: POST /api/uploads (multipart->base64 in new Upload model, <=3MB) + GET /api/uploads/[id]. Schema: InventoryItem.imageUrl + edition; InventoryCategory model. UI: InventoryToolbar (Add product / Manage categories), ProductEditor (all fields + image upload button + FDA/RxNorm prefill), CategoryManager, per-row Edit + thumbnail on /inventory.
4. CLINICAL → SPECIALTIES. New nav item under Clinical. Models Specialty/SpecialtyProvider/SpecialtyPatient. APIs /api/specialties(+[id], /providers, /patients) + /api/providers. Page /specialties (SpecialtiesClient): master-detail — add specialty (auto-seeds ~18 common), link providers (from /api/providers), connect patients (via /api/patients/search) with optional assigned specialist. GET seeds Cardiology/Pediatrics/etc once.
5. MEDICARE/MEDICAID + PRIOR-RECORD IMPORT. BlueButtonConnect (patient chart) already imports Medicare coverage + Part D meds; added "Import all to chart" bulk button (source='cms-bluebutton', idempotent dedupe in POST /api/patients/[id]/medications) and a gated "other national networks" panel (Surescripts med history / State IIS immunizations / Carequality-CommonWell allergies) labeled Connect required (need vendor onboarding + credentials — NOT live). Medicaid/real-time eligibility remains via Stedi 270/271. Medication/Allergy/Immunization got a source field.

Backend tests: 6/6 tasks PASS (auth, cache/force, check-in coverage, paginated search + filters + rxnorm, uploads, inventory+category CRUD w/ auto-SKU + soft delete, specialties CRUD + linking w/ 9 DB providers found, med source+dedupe). Frontend UI agent NOT run (awaiting user OK). Redeploy to publish to proactiveclinics.com; production Prisma push happens on deploy (new collections: Upload, InventoryCategory, Specialty, SpecialtyProvider, SpecialtyPatient + additive fields).

## Iteration — Analytics & Insights dashboard (Aug 2026, preview)
User request: add "Analytics and Insights" under Dashboard in the sidebar — detailed, filtered, segregated infographics about the whole practice; editable/customizable with drag-to-reorder boxes; Export PDF, Share, and Presentation (opens a frameless branded tab for pitches/meetings).

Delivered (backend agent-tested; UI screenshot-verified in preview):
- BACKEND: GET /api/analytics?from&to (src/lib/analytics.ts + route) — one read-only aggregation across patients, scheduling, revenue/claims/remits/POS/eligibility, pharmacy/orders, inventory, specialties, providers. Headline KPIs via count(); breakdowns/time-series via capped(20k) minimal-field arrays bucketed in JS; every query defensively wrapped. Default range = last 12 months.
- CHARTS: dependency-free SVG/CSS primitives (src/components/analytics/charts.tsx) — KpiStat, BarChart, LineArea (gradient area), Donut, HBars. No new npm deps.
- BOARD: src/components/analytics/AnalyticsBoard.tsx — filter presets (30d/90d/12m/YTD + custom date inputs), ~24 widgets segregated by Overview/Patients/Scheduling/Revenue/Pharmacy&Inventory/Specialties. "Customize layout" enables native HTML5 drag-to-reorder + hide/restore widgets + Reset; layout persisted to localStorage (pc-analytics-layout-v1). Toolbar: Export PDF (opens present?print=1 -> window.print), Share (Web Share/clipboard of /analytics?from&to), Presentation (opens frameless tab).
- PAGES: /analytics (src/app/(app)/analytics/page.tsx, in Shell) and /analytics/present (frameless, NO Shell — (app)/layout adds only SessionGuard) with a branded gradient header (emblem /icon-192.png + clinic name + range + prepared-by + timestamp) and @media print CSS (A4 landscape) for clean PDF export. Both require staff session (middleware + requireSession).
- NAV: added "Analytics & Insights" right under Dashboard in the Clinical group (new Icon.Chart in Shell.tsx).
Verified: /api/analytics 200 w/ real data (21 patients, 29 appts, $18,870 inventory, 18 specialties); backend agent PASS (auth/shape/default/tiny-range); screenshots of dashboard (KPIs+area chart+toolbar) and frameless present view. Frontend UI test agent NOT run (needs user OK). Preview-only; redeploy to publish to proactiveclinics.com.

## Iteration — "Request a Demo" marketing page + URGENT email (Aug 2026, preview)
User request: make all "Request a Demo" buttons open a branded marketing page with a proper contact form; on submit send an URGENT email (subject "Demo Request from Prospect") to info@210codelabs.com CC andy@proactivemedclinic.com.
Delivered:
- NEW public branded page /demo (src/app/demo/page.tsx + DemoRequestForm.tsx): marketing pitch (platform highlights + standards strip) + full contact form (name, work email, phone, organization, role, practice size, interest chips, best time, message) with honeypot + success state.
- POST /api/demo (public): validates (zod), persists a DemoRequest lead (new Prisma model) as a safety net, then sends the URGENT email via new sendDemoRequest() in src/lib/email.ts — to info@210codelabs.com, CC andy@proactivemedclinic.com, replyTo=prospect, subject EXACTLY "Demo Request from Prospect", priority headers (X-Priority:1, Importance:high, Priority:urgent). Returns {ok, emailStatus, referenceId}. emailStatus="skipped" until Resend is configured (lead still saved).
- Repointed ALL "Request a Demo" CTAs from /book -> /demo: LandingHeader.tsx (topbar; mobile label now "Demo") + 3 CTAs in src/app/page.tsx. Verified rendered landing shows /demo links and 0 /book demo links.
- Middleware: /demo (PUBLIC_EXACT) + /api/demo (PUBLIC_PREFIX) are public (no login).
Verified: /demo renders 200 public; POST /api/demo -> {ok:true, emailStatus:"skipped", referenceId} (lead persisted). 
BLOCKER for live email: RESEND_API_KEY + EMAIL_FROM (verified sender domain in Resend) are NOT set — email currently skipped. Need user to provide Resend API key + a verified from-address. Preview-only; redeploy to publish.

## Iteration — eRx (E-Prescription) (Aug 2026, preview)
User request: add eRx sidebar item wired to FDA meds + NPPES pharmacy + integrations; print/export PDF prescription with practice letterhead/NPI/signature + provider NPI + e-signature (typed or drawn).
Delivered:
- Sidebar "eRx" under Pharmacy & Retail -> /erx (src/app/(app)/erx/page.tsx + ErxBuilder.tsx + SignaturePad.tsx).
- Builder wires EXISTING integrations: patient via /api/patients/search, medication via openFDA DrugSearch (name/strength/form/ndc), pharmacy via PharmacyPicker (internal + NPPES national registry), sig/qty/refills/DAW/notes, provider name (from session) + editable provider NPI, and a provider e-signature pad (Type OR Draw on canvas -> PNG dataURL).
- New Prisma model Prescription. POST /api/erx creates the signed Rx (and a best-effort Order type=rx when a patient is linked). GET /api/erx lists recent.
- PDF: GET /api/erx/[id]/pdf (pdf-lib) with branded letterhead pulling practice name/NPI/address/phone from getStediConfig() (admin-configured; falls back to "Proactive Clinic"), patient block, Rx symbol + medication/sig/qty/refills/DAW, pharmacy block (name/addr/phone/NPI), and signature block (embedded drawn PNG or cursive typed name) + provider NPI + "Electronically signed" timestamp.
Verified: /erx 200; POST /api/erx -> {ok,id}; PDF -> 200 application/pdf valid %PDF-; sidebar /erx link present. Preview-only; redeploy to publish. NOTE: letterhead NPI/address come from Stedi/admin config; set them for a complete letterhead.

## Iteration — Wiring audit: Stedi payer picker everywhere + eRx connections (Aug 2026, preview)
User request: no loose/empty boxes — patient boxes searchable against real list; pharmacy/NPI always NPPES; meds always FDA; Medicare via Blue Button; insurance eligibility (except Medicare) ALWAYS Stedi with a searchable Stedi PAYER picker everywhere.
Delivered / verified:
- EligibilityChecker: replaced the raw "Payer ID" text box with the searchable <PayerAutocomplete/> (live Stedi payer directory search; fills payerName + Stedi payerId; guards submit until a payer is selected). Verified: /api/stedi/payers?stedi=aetna -> 25 live results; billing page renders 200.
- eRx patient box already wired to /api/patients/search (verified 5 results) — searchable real patient list.
- Confirmed already-correct wiring (no change needed): patient registration (NewPatientForm) payer uses PayerAutocomplete; pharmacy selection uses PharmacyPicker (internal + NPPES national registry + import); medications use openFDA DrugSearch; Medicare coverage/meds via BlueButtonConnect.
- Remaining raw payer-ID inputs are in advanced/manual tools by design (AiCodingAssistant, RevenueCycle manual claim entry line ~195/519, InsuranceCard field) — can be swapped to PayerAutocomplete on request.
Note: A full app-wide "every box" audit is large; this pass wired the primary insurance-eligibility + eRx flows. Preview-only; redeploy to publish.
