/* Complete User Guide content — shared by the web pages and the print PDF.
   Screenshots are real captures of the preview app (public/guide/shots),
   hero images are photorealistic graphics (public/guide/img). */

export type GuideBlock =
  | { type: "p"; text: string }
  | { type: "subhead"; text: string }
  | { type: "steps"; title?: string; items: string[] }
  | { type: "tip"; text: string; kind?: "tip" | "warn" }
  | { type: "shot"; src: string; caption: string };

export type GuideSection = {
  slug: string;
  title: string;
  summary: string;
  hero: string; // /guide/img/*.jpg
  icon: string; // svg path d
  audience?: string;
  blocks: GuideBlock[];
};

const IMG = "/guide/img";
const S = "/guide/shots";

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    slug: "whats-new",
    title: "What's New",
    summary: "Recent enhancements — a public Integration API, the Day Agenda calendar widget with waitlist offers, smarter pharmacy search (NPI, recent, distance) and pharmacy assignment at registration and from the Pharmacy module.",
    hero: `${IMG}/tech.jpg`,
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    audience: "All staff",
    blocks: [
      { type: "p", text: "Here's what's new in this release and where to find it." },
      { type: "subhead", text: "Integration API for external apps" },
      { type: "steps", title: "Highlights", items: [
        "New Admin → API & Integrations page to issue API keys so outside apps (e.g. a remote behavioral-health platform) can securely connect.",
        "Each key is scoped (patients, appointments, encounters — read/write), can be enabled/disabled, rotated or revoked, and shows its usage.",
        "A built-in API Reference documents every endpoint with examples — see the new “API & Integrations” section below.",
      ] },
      { type: "subhead", text: "Day Agenda calendar widget" },
      { type: "steps", title: "Highlights", items: [
        "Click any date box (Month/Week/Dashboard) or the date header (Day/Staff) to open a floating Day Agenda showing that day's appointments and open time slots.",
        "Move an appointment to another slot by dragging it onto the slot (or Move → pick a slot) — clashes auto-shift to the nearest open time.",
        "Offer a freed/open slot to the next waitlisted patient in one click; appointments are tinted by provider color.",
      ] },
      { type: "subhead", text: "Smarter pharmacy search & assignment" },
      { type: "steps", title: "Highlights", items: [
        "Search 89,000+ real pharmacies by name, NCPDP, NPI, address, city, state or zip — Weno-connected pharmacies rank first, with a result count and a scrollable list.",
        "Recently-used pharmacies show as quick-picks; toggle “Sort by distance” to order matches nearest the patient's ZIP.",
        "Set a Preferred Pharmacy right on the New Patient form, and assign a pharmacy to any patient from Pharmacy → E-prescribe routing → Assign to patient.",
      ] },
      { type: "tip", text: "See the API & Integrations, Scheduling, Patients and E-Prescribing sections below for full step-by-step details." },
    ],
  },
  {
    slug: "getting-started",
    title: "Getting Started & Signing In",
    summary: "Log in, learn the layout, and find your way around Proactive Clinic.",
    hero: `${IMG}/clinical.jpg`,
    icon: "M11 16l-4-4m0 0l4-4m-4 4h14M5 20h4",
    audience: "All staff",
    blocks: [
      { type: "p", text: "Proactive Clinic is a web-based EHR/EMR you open in any modern browser — no install required. Staff sign in with an email and password; patients and attorneys use their own portals." },
      { type: "subhead", text: "Sign in" },
      { type: "steps", title: "To log in as staff", items: [
        "Go to your clinic web address and click Staff Login (or open /login).",
        "Enter your work email and password.",
        "Click Sign In. You'll land on your Dashboard.",
        "Use the language toggle (EN / ES) at the top of the sign-in card if you prefer Spanish.",
      ] },
      { type: "tip", text: "For security, you're automatically signed out after 30 minutes of inactivity. Never share your password — every action is tied to your account for the audit trail." },
      { type: "subhead", text: "The layout" },
      { type: "p", text: "The left sidebar is your main menu, grouped into Clinical, Pharmacy & Retail, Operations and Admin. The top bar shows the current date/time, clinic location, global search, and quick actions. You can collapse the sidebar with the ‹ arrow to get more room." },
      { type: "shot", src: `${S}/dashboard.png`, caption: "The main workspace: sidebar menu (left), top utility bar, and your dashboard." },
      { type: "tip", text: "All dates and times across the app are shown in Central Time (CT). Look for the “All times Central (CT)” badge on scheduling and booking screens." },
    ],
  },
  {
    slug: "dashboard",
    title: "Dashboard",
    summary: "Your daily home base: today's numbers, live operations, and quick links.",
    hero: `${IMG}/tech.jpg`,
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    audience: "All staff",
    blocks: [
      { type: "p", text: "The dashboard greets you with five KPI cards — Today, Open Notes, Pending Orders, Unread Messages and Patients. Each card is clickable and jumps straight to that area, pre-filtered where it makes sense." },
      { type: "steps", title: "The KPI cards", items: [
        "Today → opens the Schedule.",
        "Open notes → opens Encounters filtered to unsigned notes.",
        "Pending orders → opens Orders filtered to pending items.",
        "Unread msgs → opens your Messages.",
        "Patients → opens the Patients list.",
      ] },
      { type: "p", text: "Below the cards, Live Operations shows a real-time snapshot of patient flow (scheduled, checked-in, in-room, completed, no-show) and work queues that auto-refresh, so the front desk and clinical team always see the same picture." },
      { type: "shot", src: `${S}/dashboard.png`, caption: "Dashboard KPIs, Live Operations panel, today's schedule and open notes." },
    ],
  },
  {
    slug: "scheduling",
    title: "Scheduling & Calendar",
    summary: "Book, drag-to-reschedule and create repeating visits across day, week, month and staff views.",
    hero: `${IMG}/reception.jpg`,
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    audience: "Front desk, providers",
    blocks: [
      { type: "p", text: "Open Schedule from the sidebar. Switch between Day, Week, Month and Staff views using the toggle at the top-left. Use the ← Today → controls to move through dates, and the provider dropdown to focus on one provider." },
      { type: "tip", text: "The clinic is open 9:00 AM – 8:00 PM Central. The calendar grid and every booking form enforce these hours — you can't accidentally book outside them.", kind: "warn" },
      { type: "subhead", text: "Book an appointment (front desk)" },
      { type: "steps", title: "New appointment", items: [
        "On the Schedule, click + New Appointment (top-right).",
        "Search the patient by name, MRN or DOB and select them.",
        "Pick the provider and service/visit type.",
        "Choose the date and a time between 9:00 AM and 8:00 PM.",
        "(Optional) Set Repeat to create a recurring series — see “Repeating visits” below.",
        "Click Schedule. The visit appears on the calendar color-coded by provider.",
      ] },
      { type: "shot", src: `${S}/schedule.png`, caption: "Month view with color-coded providers, status legend and the New Appointment button." },
      { type: "subhead", text: "Repeating visits" },
      { type: "p", text: "Recurring therapy or follow-up plans can be booked in one step from the New Appointment window." },
      { type: "steps", title: "Create a series", items: [
        "In New Appointment, choose the patient, provider, service, first date and time.",
        "Set Repeat to Daily, Weekly, Every 2 weeks or Monthly.",
        "Enter how many Occurrences to create (2–26). The button updates to read “Schedule N visits”.",
        "Click Schedule. Every occurrence is created at the same time on the recurring dates.",
      ] },
      { type: "tip", text: "Any occurrence that would fall outside clinic hours or clash with the provider is skipped automatically, and the window shows how many visits were created versus skipped." },
      { type: "subhead", text: "Reschedule by dragging (every view)" },
      { type: "p", text: "You can drag an appointment to move it in any calendar view — the visit's duration is always kept." },
      { type: "steps", title: "How dragging works per view", items: [
        "Day: drag a visit up or down the time rail to change its time.",
        "Week: drag a visit onto another day column to move it to that day (same time).",
        "Month: drag a visit onto another date to move it (same time).",
        "Staff: drag a visit within a provider's column to change the time, or across to another provider's column to reassign it.",
      ] },
      { type: "tip", text: "As you drag, open time slots turn green and any slot that would double-book the provider turns red — a clashing drop is blocked, so you can't accidentally overbook. If you book into an occupied or after-hours slot, the visit is automatically moved to the next available time that day. If a move can't be saved, an on-screen message explains why and the visit snaps back to where it was." },
      { type: "subhead", text: "Day Agenda widget (appointments, open slots & waitlist)" },
      { type: "p", text: "Click any date box in Month/Week (or the date header in Day/Staff, and the Dashboard mini-calendar) to open a floating Day Agenda for that day." },
      { type: "steps", title: "What you can do", items: [
        "See every appointment for the chosen provider that day (tinted by provider color) alongside a grid of open time slots.",
        "Move an appointment: drag its card onto an open slot, or click Move then a slot — a clash auto-shifts to the nearest open time.",
        "Fill a slot from the waitlist: the next matching waiting patient appears with “Offer next open” (one click) or “Pick slot” — the patient gets a self-confirm link.",
        "Click any open slot to start a New Appointment already set to that time.",
      ] },
      { type: "shot", src: `${S}/day-agenda.jpg`, caption: "The Day Agenda widget — provider-colored appointments, open time slots, and one-click waitlist offers." },
      { type: "subhead", text: "Manage the day (Day view)" },
      { type: "steps", title: "During the day", items: [
        "The Day view shows a 9 AM–8 PM time grid with every visit placed in its slot.",
        "Click an empty time slot to start a New Appointment already set to that time.",
        "Check patients in, mark them in-room, or complete visits from each card.",
        "Copay and balance indicators help the front desk collect at check-in.",
      ] },
      { type: "shot", src: `${S}/schedule-day.png`, caption: "Day view with the 9 AM–8 PM time rail, check-in, copay and balance details." },
    ],
  },
  {
    slug: "patients",
    title: "Patients & Charting",
    summary: "Register new patients, search records, and work inside the patient chart.",
    hero: `${IMG}/reception.jpg`,
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    audience: "Front desk, MAs, providers",
    blocks: [
      { type: "subhead", text: "Register a new patient (front desk)" },
      { type: "steps", title: "New patient", items: [
        "Sidebar → Patients → New Patient.",
        "Enter demographics (name, DOB, sex, contact and address).",
        "Preferred Pharmacy (e-Prescribing): search the 89,000+ Weno directory (by name/NCPDP/NPI or address/city/state/zip) and pick the patient's primary pharmacy — it's optional and can be changed later from the chart.",
        "Add insurance: payer, member ID, group. Leave “Auto-verify coverage” checked to run an eligibility check automatically.",
        "Save. The patient gets an MRN and their verified coverage and pharmacy follow them into scheduling, the chart and billing.",
      ] },
      { type: "shot", src: `${S}/patient-pharmacy.jpg`, caption: "New patient registration — the Preferred Pharmacy section sits between Contact and Insurance." },
      { type: "shot", src: `${S}/patient-new.png`, caption: "New patient registration with insurance and automatic coverage verification." },
      { type: "subhead", text: "Find a patient" },
      { type: "p", text: "Use the global search in the top bar (search by name, last name, MRN or DOB) from anywhere, or open the Patients list and filter. Click a patient to open their chart." },
      { type: "shot", src: `${S}/patients.png`, caption: "The Patients list — search and open any chart." },
      { type: "subhead", text: "Inside the chart" },
      { type: "p", text: "The chart has tabs for Problems, Medications, Allergies, Vitals, Immunizations, Documents, Orders, Billing and Legal, plus the patient header with coverage. Add or edit items from each tab; everything is timestamped and audited." },
      { type: "shot", src: `${S}/patient-chart.png`, caption: "A patient chart with clinical tabs and coverage." },
    ],
  },
  {
    slug: "encounters",
    title: "Encounters & Clinical Notes",
    summary: "Start, document and sign visit notes (SOAP or simple format).",
    hero: `${IMG}/charting.jpg`,
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    audience: "Providers",
    blocks: [
      { type: "p", text: "The Encounters list shows every note with its status. Use the All / Open / Signed chips to filter. Open notes are unfinished and appear on the dashboard until signed." },
      { type: "steps", title: "Document a visit", items: [
        "Open the patient's appointment or start a new encounter from their chart.",
        "Enter the chief complaint, then document using SOAP (Subjective, Objective, Assessment, Plan) or the simple note format.",
        "Add diagnoses, orders and vitals as needed — they link to the encounter.",
        "Sign the note to finalize it. Signed notes are locked; corrections are made as an addendum.",
      ] },
      { type: "shot", src: `${S}/encounters.png`, caption: "Encounters list with status filters." },
      { type: "tip", text: "Unsigned (open) notes are the “Open notes” count on your dashboard — sign them promptly to keep charts and billing current." },
    ],
  },
  {
    slug: "orders",
    title: "Orders (Rx, Labs & More)",
    summary: "Send prescriptions and lab, imaging, referral and procedure orders.",
    hero: `${IMG}/charting.jpg`,
    icon: "M9 3v6L4 19a2 2 0 002 3h12a2 2 0 002-3l-5-10V3M9 3h6",
    audience: "Providers, MAs",
    blocks: [
      { type: "p", text: "Orders can be placed from the patient chart or reviewed in the central Orders workspace. Filter by type (Rx, Lab, Imaging, Referral, Procedure) or status (Pending, Completed)." },
      { type: "steps", title: "E-prescribe", items: [
        "In the chart → Orders → New, choose Rx (or open e-Prescribe (Weno) in the sidebar).",
        "Search the medication, set strength, form, sig and quantity.",
        "Search the pharmacy by name/NCPDP — or by address, city, state and zip — across the Weno directory and the national registry, then select it.",
        "Confirm the prescriber in “Prescribe as”, then sign/send; track pending vs. sent counts in the Orders workspace.",
      ] },
      { type: "steps", title: "Lab order", items: [
        "Choose Lab, pick the test(s) and add clinical instructions.",
        "Route to the lab; the order shows as Pending until sent.",
      ] },
      { type: "shot", src: `${S}/orders.png`, caption: "The Orders workspace with type/status filters and routing controls." },
      { type: "tip", text: "Pharmacy e-prescribe and lab routing are enabled per your clinic's admin settings. If a control is greyed out, an admin needs to enable that module or grant your role permission." },
    ],
  },
  {
    slug: "eprescribing-weno",
    title: "E-Prescribing with Weno",
    summary: "Search 89,000+ real pharmacies (Weno directory + national registry), choose the right prescriber, launch Weno EZ ComposeRx embedded in the chart, and track delivery in Rx history.",
    hero: `${IMG}/clinical.jpg`,
    icon: "M19 7h-3V6a2 2 0 00-2-2h-4a2 2 0 00-2 2v1H5a1 1 0 000 2h1v9a2 2 0 002 2h8a2 2 0 002-2V9h1a1 1 0 100-2zM10 6h4v1h-4V6zm2 5a1 1 0 011 1v2h2a1 1 0 110 2h-2v2a1 1 0 11-2 0v-2H9a1 1 0 110-2h2v-2a1 1 0 011-1z",
    audience: "Providers, MAs, Admin",
    blocks: [
      { type: "p", text: "Electronic prescribing runs on Weno EZ Integration. From a patient's chart you open e-Prescribe (Weno), choose the prescriber, and Weno's ComposeRx screen opens embedded in the EHR — pre-filled with the patient and their pharmacy. Delivery status flows back into Rx history. The pharmacy search is backed by Weno's full LITE directory (89,000+ pharmacies with real NCPDP IDs) and is combined with the NPPES national registry." },
      { type: "shot", src: `${S}/erx-weno.png`, caption: "The eRx module: embedded Weno EZ ComposeRx, structured pharmacy search, the “Prescribe as” picker, NPI lookup and Test Weno connection." },

      { type: "subhead", text: "Find a pharmacy (structured search)" },
      { type: "steps", title: "Pharmacy search", items: [
        "Type a pharmacy name, NCPDP ID or a 10-digit NPI in the main box for a quick lookup.",
        "Click “Search by address / city / state / zip / NPI” to combine fields — ideal for finding a specific location of a chain, or add the NPI field to pin an exact pharmacy.",
        "Recently-used pharmacies appear as quick-pick chips above the search; when the patient's ZIP is known, tick “Sort by distance” to order matches nearest to them.",
        "Results show a count (e.g. “Showing 61 of 391”) in a scrollable list and combine sources: “Weno” (real NCPDP, ready to route — a ✓ marks Weno-connected and these rank first), “Saved” (your local directory) and “National” (NPPES).",
        "Pick a “National” (NPPES) result and it is auto-added to your directory so it becomes selectable/routable next time.",
      ] },
      { type: "tip", text: "Staff can also assign a pharmacy to a patient outside the chart: Pharmacy (sidebar) → E-prescribe routing → Assign to patient. Search the patient, press Add / Assign, and it becomes their primary pharmacy." },
      { type: "shot", src: `${S}/pharmacy-assign.jpg`, caption: "Pharmacy → E-prescribe routing: recently-used quick-picks, Send Pending Rx, and Assign to patient." },

      { type: "subhead", text: "Choose the prescriber (“Prescribe as”)" },
      { type: "p", text: "On the e-Prescribe screen the “Prescribe as” dropdown lists every valid prescriber — both Weno-registered prescribers and any provider account that has an NPI — so the correct provider can always be chosen no matter who is logged in or which admin account is in Settings. The right prescriber is auto-selected for your login (matched by account, then NPI, then name, then the clinic default)." },
      { type: "steps", title: "Prescriber tools", items: [
        "Prescribe as: pick the provider; ComposeRx opens as that prescriber when they have their own Weno login on file, otherwise it opens with the clinic account.",
        "Find prescriber NPI (NPPES): search by first/last name to fill the NPI from the national registry.",
        "Test Weno connection: instantly confirms Weno EZ Integration is configured and the launch is ready.",
      ] },
      { type: "tip", text: "To attribute a prescription to a specific provider, an admin adds that prescriber's own Weno email + password under Admin → Connections → Weno EZ Integration. Passwords are stored securely and never shown again." },

      { type: "subhead", text: "Prescribe in Weno EZ Integration (ComposeRx)" },
      { type: "steps", title: "Launch Weno EZ Integration", items: [
        "Open a patient's chart and choose e-Prescribe (Weno).",
        "Confirm the prescriber in “Prescribe as”; the embedded ComposeRx screen loads pre-filled with the patient (and their preferred pharmacy if set).",
        "Complete and send the prescription; a “Composing” entry appears in Rx history right away.",
      ] },
      { type: "tip", text: "Weno EZ Integration launch requires your clinic's Weno account, admin email/password and Location ID to be configured (Admin → Connections → Weno EZ Integration). The screen shows a clear error until setup is complete." },

      { type: "subhead", text: "Track delivery in Rx history" },
      { type: "p", text: "Open the Rx history tab to see every prescription with a live Weno status badge — Composing, Submitted, Delivered, Rejected, Cancelled or Send error. Turn on Auto to refresh statuses automatically, or click “Check status” any time. Reprint or re-prescribe from the same row." },
      { type: "shot", src: `${S}/erx-history.png`, caption: "Rx history with Weno delivery badges, auto-refresh, Check status, and reprint / re-prescribe." },

      { type: "subhead", text: "Admin: configure & maintain Weno" },
      { type: "steps", title: "Admin → Connections → Weno EZ Integration", items: [
        "Credentials: enter the admin email, password, EHR Encryption Key and Location ID, choose the environment, and use Test Connection to verify.",
        "Pharmacy directory: click “Full sync now” (weekly) to load the full Weno directory with real NCPDP IDs, and “Daily changes” (nightly) to stay current — the report shows how many pharmacies were updated.",
        "Registered prescribers: add each prescriber's NPI/DEA, and optionally their own Weno email + password + Location ID so ComposeRx opens as them; set one as the default.",
        "Apply from environment / Relabel: one-click helpers to load settings from server variables after a deploy and tidy legacy pharmacy tags.",
      ] },
      { type: "shot", src: `${S}/weno-admin.png`, caption: "Admin Connection Health: Weno directory sync, one-click maintenance, and the registered-prescriber directory." },
      { type: "tip", text: "Live prescribing/transmission requires Weno onboarding — a Weno account, valid credentials, your server's outbound IP allow-listed, and Weno certification. Start in the test environment; the printed prescription remains a fallback and is not proof of electronic transmission.", kind: "warn" },
    ],
  },
  {
    slug: "billing-eligibility",
    title: "Billing & Insurance Eligibility",
    summary: "Check coverage, view the eligibility report, and manage patient balances.",
    hero: `${IMG}/billing.jpg`,
    icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
    audience: "Front desk, billing",
    blocks: [
      { type: "p", text: "Coverage is verified automatically at registration and can be re-checked any time. The Billing area covers eligibility, patient balances, statements and the connection to the Revenue Cycle workspace." },
      { type: "subhead", text: "Run an eligibility check" },
      { type: "steps", title: "Eligibility", items: [
        "Open the patient chart → Coverage, or Billing → Eligibility Report.",
        "Confirm payer and member ID, then click Verify/Re-verify.",
        "Review the returned benefits: plan status, copay, deductible and coverage dates.",
        "The result is saved to the patient and reused in scheduling and claims.",
      ] },
      { type: "shot", src: `${S}/eligibility.png`, caption: "The eligibility report shows real-time benefits from the payer." },
      { type: "shot", src: `${S}/billing.png`, caption: "The Billing workspace — balances, statements and links to the revenue cycle." },
      { type: "tip", text: "Eligibility, claims and ERA run through Stedi. If a check fails, confirm the payer ID and member ID are correct before retrying." },
    ],
  },
  {
    slug: "claims-revenue-cycle",
    title: "Claims & Revenue Cycle",
    summary: "Prior authorization, claim submission, claim status, denials, ERA posting, enrollment and fee schedule.",
    hero: `${IMG}/claims.jpg`,
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    audience: "Billing team",
    blocks: [
      { type: "p", text: "Open Billing → Revenue Cycle. The workspace has tabs for Prior Auth, Claims, Denials, Remittances, Enrollment, Payers and Fee Schedule. This is the hub for the billing team." },
      { type: "shot", src: `${S}/revenue-cycle.png`, caption: "Revenue Cycle: Prior Auth, Claims, Denials, Remittances, Enrollment, Payers and Fee Schedule tabs." },
      { type: "subhead", text: "Prior authorization" },
      { type: "steps", title: "Track an authorization", items: [
        "On the Prior Auth tab, use “Check if required” to detect (via a live eligibility check) whether the payer requires authorization for a service.",
        "If required, obtain the auth from the payer portal/phone, then record the CPT/HCPCS, ICD-10, units, dates, status and auth number.",
        "Save — the authorization links to the patient chart and any related claims.",
      ] },
      { type: "tip", text: "Electronic 278 submission is not offered by the clearinghouse, so Prior Auth is a tracker/detector: it tells you when an auth is needed and stores the number and dates once you have it.", kind: "warn" },
      { type: "subhead", text: "Submit and track claims" },
      { type: "steps", title: "Claim lifecycle", items: [
        "Create the claim from a signed encounter (charges, CPT/ICD, provider and payer).",
        "Submit the claim to the payer through the clearinghouse.",
        "Track its status on the Claims tab — submitted, accepted, paid or denied — with a stored status history.",
        "Work denials from the Denials tab: review the reason, correct, and resubmit.",
      ] },
      { type: "subhead", text: "Post payments (ERA / 835)" },
      { type: "steps", title: "Remittances", items: [
        "Electronic remittances (ERA/835) arrive automatically and appear on the Remittances tab.",
        "Each remittance is matched to its claim and can be reconciled to the deposit account it paid into.",
        "Payers or remittances without a linked, verified deposit account are flagged so nothing is missed.",
      ] },
      { type: "subhead", text: "Payer enrollment & deposit accounts" },
      { type: "steps", title: "Enrollment", items: [
        "Use the Enrollment tab to manage EDI/ERA/EFT enrollment with each payer.",
        "Link a verified bank/deposit account (set up in Billing → Bank & EFT) so ERA/EFT payments land in the right place.",
        "Maintain payer records and your Fee Schedule from their respective tabs.",
      ] },
    ],
  },
  {
    slug: "intake-kiosk",
    title: "Intake Forms & Kiosk",
    summary: "Send digital intake forms and let patients self-check-in on a kiosk.",
    hero: `${IMG}/tech.jpg`,
    icon: "M9 17.25V21m6-3.75V21M4.5 4.5h15a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 15V6a1.5 1.5 0 011.5-1.5z",
    audience: "Front desk",
    blocks: [
      { type: "p", text: "Intake Forms collect demographics, history, consents and HIPAA acknowledgements digitally before the visit. Completed forms arrive in the Intake Inbox for the front desk to review and attach to the chart." },
      { type: "steps", title: "Kiosk mode", items: [
        "Open Kiosk mode on a tablet at the front desk.",
        "Patients confirm their identity and complete or update their intake.",
        "Submissions route to the Intake Inbox for staff verification.",
      ] },
      { type: "tip", text: "Kiosk and intake displays also respect the clinic's 9 AM–8 PM Central hours." },
    ],
  },
  {
    slug: "portals",
    title: "Patient & Attorney Portals",
    summary: "Self-service booking and records for patients; approved record access for attorneys.",
    hero: `${IMG}/clinical.jpg`,
    icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4 0M17 8a3 3 0 11-6 0 3 3 0 016 0z",
    audience: "Patients, attorneys, front desk",
    blocks: [
      { type: "subhead", text: "Patient portal" },
      { type: "p", text: "Patients sign in to request appointments, view visit info and message the clinic. The public booking page (/book) lets new and existing patients request a visit within clinic hours." },
      { type: "shot", src: `${S}/book.png`, caption: "The public booking page — new and current patients request appointments." },
      { type: "subhead", text: "Attorney portal" },
      { type: "p", text: "Authorized attorneys submit record requests and, once staff approve them, download the records directly as a branded Summary PDF or a portable C-CDA file." },
    ],
  },
  {
    slug: "records-ehi",
    title: "Records Requests & EHI Export",
    summary: "Fulfill records requests and export a patient's full record (ONC Cures Act).",
    hero: `${IMG}/billing.jpg`,
    icon: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
    audience: "Front desk, HIM, admin",
    blocks: [
      { type: "subhead", text: "Attorney / records requests" },
      { type: "steps", title: "Approve and release", items: [
        "Open Records Requests to see incoming attorney requests.",
        "Verify the patient identity and approve (or deny) the request.",
        "Once approved, the attorney downloads a Summary PDF or C-CDA from their portal.",
        "Every release is logged in the “Records Released” history (who, which chart, when and in what format).",
      ] },
      { type: "shot", src: `${S}/records-requests.png`, caption: "Attorney record requests plus the Records Released audit history." },
      { type: "subhead", text: "EHI Export (Cures Act)" },
      { type: "p", text: "Settings → EHI Export produces a patient's — or the whole practice's — Electronic Health Information in standard formats required by the 21st Century Cures Act (45 CFR 170.315(b)(10))." },
      { type: "steps", title: "Export a record", items: [
        "Open Settings → EHI Export.",
        "For one patient: search and select them, then choose Summary PDF, C-CDA (.xml), FHIR bundle (.zip) or FHIR .ndjson.",
        "For the whole practice: use the batch buttons to export everyone as FHIR, or as a zip of per-patient PDFs / C-CDAs.",
        "Exports are audit-logged; handle the files as PHI.",
      ] },
      { type: "shot", src: `${S}/ehi-export.png`, caption: "EHI Export — human-readable (PDF / C-CDA) and machine-readable (FHIR) formats." },
    ],
  },
  {
    slug: "api-integrations",
    title: "API & Integrations",
    summary: "Issue scoped API keys so external apps can securely connect to ProactiveClinics, and read the built-in API reference.",
    hero: `${IMG}/tech.jpg`,
    icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
    audience: "Admin",
    blocks: [
      { type: "p", text: "The Integration API lets outside applications (for example a remote behavioral-health platform) securely exchange data with ProactiveClinics over a JSON REST API. Manage everything from Admin → API & Integrations." },
      { type: "shot", src: `${S}/api-integrations.jpg`, caption: "Admin → API & Integrations: create and manage per-app API keys, with a link to the full API Reference." },
      { type: "subhead", text: "Create & manage keys" },
      { type: "steps", title: "Issue an integration key", items: [
        "Go to Admin → API & Integrations and click “+ New integration key”.",
        "Name the app, set a rate limit, and choose scopes (patients, appointments, encounters — read and/or write).",
        "Click Create. The Key ID and secret token are shown once — copy them now; the secret is stored hashed and never displayed again.",
        "Later you can Enable/Disable, Rotate the secret, or Revoke a key. Usage (request count and last-used) shows on each row.",
      ] },
      { type: "subhead", text: "How partners connect" },
      { type: "steps", title: "For the external app", items: [
        "Base URL: your clinic address + /api/v1.",
        "Send the token on every request as “Authorization: Bearer <keyId>.<secret>” (or the X-API-Key header).",
        "Endpoints: GET /v1/ping (verify), patients (list/create/get), appointments (list/create — auto-shifts clashes), encounters (list/create). Each is limited to the key's scopes.",
        "Open “View API Reference” on the page for full request/response examples and error codes.",
      ] },
      { type: "tip", text: "Give each partner their own key with only the scopes they need, and rotate or revoke immediately if a secret is ever exposed.", kind: "warn" },
    ],
  },
  {
    slug: "settings-admin",
    title: "Settings & Admin",
    summary: "Configure the clinic, users, roles, catalogs, integrations and data tools.",
    hero: `${IMG}/tech.jpg`,
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z",
    audience: "Admins",
    blocks: [
      { type: "p", text: "Admins manage the clinic from Settings: users and roles, clinical catalogs (services, problems, meds), charting templates, branding, integrations and operational modules. Role-based access controls what each staff type can see and do." },
      { type: "shot", src: `${S}/settings.png`, caption: "The Settings hub — configuration, catalogs, integrations, EHI export and admin tools." },
      { type: "steps", title: "Common admin tasks", items: [
        "Add a user: Admin → Users → invite, set role and provider details (add an NPI so they appear in the eRx “Prescribe as” list).",
        "Enable a module (e.g., pharmacy routing, Labcorp): Admin operational settings.",
        "Weno e-prescribing: Admin → Connections → Weno EZ Integration to set credentials, sync the pharmacy directory, and register prescribers.",
        "Connect a data source for migration: Settings → FHIR import (Practice Fusion / Veradigm).",
        "Export EHI or clone the platform installer from Settings.",
      ] },
      { type: "tip", text: "Changes made in preview must be redeployed to appear on your live site." },
    ],
  },
];

export function getSection(slug: string) {
  return GUIDE_SECTIONS.find((s) => s.slug === slug) || null;
}
