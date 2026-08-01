# Clinic Platform — White-label Starter (Installer / Cloner)

A self-contained, re-brandable clinic platform (EHR + Patient Portal + Kiosk +
Legal/Rehabilitation cases + Attorney Portal + Pharmacy/POS + AI assistant),
built with **Next.js 15 + Prisma + MongoDB**. Clone it, run one setup command,
log in as admin, and a guided **/setup** wizard lets you brand the whole app
(name, address, phone, corporate division, color palette with live preview,
logos, hero/kiosk slides — default / upload / AI-generated) and toggle modules
— **no code edits required**.

> This package does not constitute legal, HIPAA or compliance certification. It
> provides workflows that require your own legal, security and compliance review
> before real clinical/PHI use.

> 📘 **Full step-by-step platform guides (Emergent, Codex, OpenCode, VS Code,
> Cursor, Docker, Vercel & more) are in [`INSTALL.md`](./INSTALL.md).**

---

## Quick start (1 command after env + install)

```bash
# 1) Configure environment
cp .env.example .env          # then edit values (MONGO_URL, AUTH_SECRET, ...)

# 2) Install dependencies (use yarn)
yarn install

# 3) One-command setup: generate client, sync schema, seed demo data + catalogs
yarn setup

# 4) Run
yarn dev                      # http://localhost:3000
```

Then open the app, click **Staff Access**, log in with the demo admin
(`admin@clinic` shown on the login page while `ALLOW_DEMO_LOGIN=true`). On first
login as admin you are automatically taken to **/setup** to brand the
deployment. You can re-run it anytime from **Settings → Branding & Deployment
Setup**.

---

## Deploy on Emergent

1. Create a new project and upload/import this folder (or connect the repo).
2. Emergent injects `MONGO_URL`, `DB_NAME`, `NEXT_PUBLIC_BASE_URL` per
   environment — you do not need to set those manually.
3. Set `AUTH_SECRET` (32+ chars) and, optionally, `EMERGENT_LLM_KEY` (from
   Emergent → Account Settings → Universal Key) to enable AI features.
4. Deploy. The start script runs `prisma db push` and seeds automatically.

## Deploy locally / VS Code / Cursor

- Requires Node 18+, Yarn, and a MongoDB **replica set** (Prisma needs one).
  For a quick local replica set: `mongod --replSet rs0` then
  `mongosh --eval "rs.initiate()"`.
- Follow the Quick start above.

---

## What the /setup wizard configures

| Step | Controls |
|------|----------|
| Identity | Clinic name, corporate division, tagline, full address, phone, email, website |
| Branding | Primary / secondary / accent colors (live preview), header + footer logo upload |
| Images & Slides | Hero/kiosk slides: keep curated defaults, upload your own, or generate with AI (`gpt-image-1` via the Emergent Universal Key — optional) |
| Modules | Enable/disable EHR, Patient Portal, Kiosk, Legal cases, Attorney Portal, Pharmacy/POS, AI Assistant |
| Review | Summary + finish (marks setup complete) |

Branding is stored in MongoDB (`AppSetting` key `site_config`; logos/slides in
`BrandAsset`) so a fresh deployment keeps its identity without external storage.
Colors re-theme the entire UI at runtime via CSS variables generated from your
primary color.

---

## Tech notes

- All backend routes live under `/api/*` (Next.js route handlers).
- Never hardcode URLs/ports — use env vars (`MONGO_URL`, `NEXT_PUBLIC_BASE_URL`).
- Prisma models use string UUID/cuid ids (no Mongo ObjectId in app code).
- AI uses the `emergentintegrations` package + the Emergent Universal Key.
