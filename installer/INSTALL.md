# Installation Manual — Clinic Platform (White-label Starter)

A re-brandable clinic platform (EHR + Patient Portal + Lobby Kiosk + Legal /
Rehabilitation cases + Attorney Portal + Pharmacy/POS + AI assistant) built with
**Next.js 15 (App Router) + Prisma + MongoDB**.

After it runs, log in as **admin** and a guided **/setup** wizard lets you brand
everything (clinic name, address, phone, corporate division, color palette with
live preview, logos, hero/kiosk slides — default / upload / AI-generated) and turn
modules on/off — **no code editing required**.

> ⚠️ This package is a technical starter. It is **not** legal, HIPAA or compliance
> certification. Complete your own security, privacy and compliance review before
> using it with real patient data (PHI).

---

## 0. Technical requirements

| Requirement | Minimum | Notes |
|-------------|---------|-------|
| **Node.js** | 18.18+ (20 LTS recommended) | `node -v` |
| **Package manager** | **Yarn** (Classic 1.x or Berry) | Use Yarn, not npm — the lockfile is `yarn.lock` |
| **Database** | **MongoDB 6+ as a replica set** | Prisma + MongoDB **requires** a replica set (even single-node). MongoDB Atlas works out of the box. |
| **OS** | Linux, macOS, or Windows (WSL2 recommended on Windows) | |
| **RAM / Disk** | 2 GB RAM, ~1.5 GB free disk | `node_modules` + build |
| **Optional: AI** | `EMERGENT_LLM_KEY` | Enables portal assistant, SOAP generation, chart Q&A and AI slide/image generation. Leave blank to disable AI. |

### Environment variables (`.env`)
Copy `.env.example` → `.env` and set:

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGO_URL` | ✅ | Mongo connection (Prisma builds `DATABASE_URL` from this at runtime). |
| `DB_NAME` | ✅ | Database name (e.g. `clinic_app`). |
| `DATABASE_URL` | ✅ (local) | Used by the Prisma CLI (`db push`). For local single-node Mongo add `?replicaSet=rs0`. For Atlas use your `mongodb+srv://…/<db>` URI. |
| `NEXT_PUBLIC_BASE_URL` | ✅ | Public URL the browser uses for API calls (e.g. `http://localhost:3000`). |
| `AUTH_SECRET` | ✅ | Session signing secret — **32+ random characters**. |
| `EMERGENT_LLM_KEY` | ⛔ optional | Universal AI key (from Emergent → Account Settings). Enables all AI features. |
| `ALLOW_DEMO_LOGIN` | ⛔ optional | `true` shows demo staff logins; set `false` for production. |

> **Never** hardcode URLs/ports in code — everything reads from these env vars.

---

## 1. Emergent  ⭐ (recommended path)

Emergent injects `MONGO_URL`, `DB_NAME` and `NEXT_PUBLIC_BASE_URL` automatically
per environment, and its MongoDB is already a replica set — so setup is minimal.

### A) New project from this package
1. Download **`clinic-installer.zip`** (from an existing deployment: **Settings →
   Deployment Installer / Cloner → Download .zip**, admin only).
2. Create a **new Emergent project** and **upload / import** the unzipped folder
   (or push it to a Git repo and connect that repo).
3. In the project **environment settings**, set:
   - `AUTH_SECRET` → a 32+ character random string.
   - `EMERGENT_LLM_KEY` → *(optional)* your Emergent Universal Key to enable AI.
   - Leave `MONGO_URL`, `DB_NAME`, `NEXT_PUBLIC_BASE_URL` as injected by Emergent.
4. **Deploy.** On boot the start script runs `prisma db push` and seeds demo data
   + clinical catalogs automatically. (If your project separates build/run, make
   sure the start command is `yarn start`, which runs `node scripts/start.js`.)
5. Open the app → **Staff Access** → log in as the demo admin (shown on the login
   screen while `ALLOW_DEMO_LOGIN=true`). You are taken straight to **/setup** to
   brand the deployment.
6. When done, **Deploy again** if you changed any environment variables.

### B) First-run branding checklist (in /setup)
1. **Identity** — clinic name, division, tagline, address, phone, email, website.
2. **Branding** — pick primary/secondary/accent colors (live preview), upload
   header + footer logos, optionally set hero & kiosk slides (defaults / upload /
   **AI** — needs `EMERGENT_LLM_KEY`). Use **Export/Import preset** to reuse a
   look across clinics.
3. **Modules** — enable only the modules this clinic needs.
4. **Review → Finish.** Done — the whole app re-themes instantly.

### Emergent troubleshooting
- **Dropdowns empty / no seed data** → redeploy; the start script self-seeds. You
  can also open any page that reads catalogs to trigger lazy seeding.
- **AI features disabled** → `EMERGENT_LLM_KEY` not set. Add it and redeploy.
- **DB connection errors** → confirm `MONGO_URL` and `DB_NAME` are present in the
  environment (Emergent injects them); do not override with localhost.

---

## 2. Codex (OpenAI Codex CLI / agent)

Codex works from a terminal in your repo. Point it at this project and let it run
the setup commands.

1. Clone/unzip the project and open it as your Codex working directory.
2. Provide Codex the goal, e.g.:
   > "Set up this Next.js + Prisma + MongoDB app: copy `.env.example` to `.env`,
   > fill `MONGO_URL`, `DATABASE_URL`, `AUTH_SECRET`; run `yarn install` then
   > `yarn setup`; then `yarn dev`. Do not change any URLs/ports."
3. Ensure a **MongoDB replica set** is reachable (local `mongod --replSet rs0` or
   Atlas). Give Codex the connection string via `.env` (never commit real secrets).
4. Ask Codex to run `yarn dev` and open `http://localhost:3000`.

**Manual equivalent (if you prefer to run it yourself):**
```bash
cp .env.example .env      # edit values
yarn install
yarn setup                # prisma generate + db push + seed + catalogs
yarn dev
```

---

## 3. OpenCode IDE

OpenCode is an open-source terminal/agent IDE. Same flow as any Node project:

1. **Open folder** → select the unzipped project root.
2. Open the integrated terminal and run:
   ```bash
   cp .env.example .env    # then edit MONGO_URL / DATABASE_URL / AUTH_SECRET
   yarn install
   yarn setup
   yarn dev
   ```
3. Use OpenCode's agent to help fill `.env` and start a local MongoDB replica set
   if you don't have one (see “Local MongoDB replica set” below).
4. Open `http://localhost:3000`, log in as admin → `/setup`.

> Tip: add `.env` to your ignore list so secrets are never committed.

---

## 4. VS Code

1. **File → Open Folder…** → the project root.
2. Recommended extensions: **Prisma**, **ESLint**, **Tailwind CSS IntelliSense**.
3. Open a terminal (``Ctrl+` ``) and run:
   ```bash
   cp .env.example .env    # edit values
   yarn install
   yarn setup
   yarn dev
   ```
4. Open the “Run and Debug” panel or just visit `http://localhost:3000`.
5. Log in as admin → complete `/setup`.

---

## 5. Cursor

Cursor is VS Code-compatible, so the steps above apply. Additionally:
1. **Open** the project folder in Cursor.
2. Use **Cursor Chat/Agent** with a prompt like:
   > "Install and run this Next.js 15 + Prisma + MongoDB app. Copy `.env.example`
   > to `.env`, set MONGO_URL/DATABASE_URL/AUTH_SECRET, run `yarn install` then
   > `yarn setup`, then `yarn dev`. Keep all env-based URLs/ports unchanged."
3. Approve the terminal commands, then open `http://localhost:3000`.

---

## 6. Local MongoDB replica set (for any local IDE)

Prisma requires a replica set. Quick single-node setup:

```bash
# Start mongod as a replica set (data dir must exist)
mongod --dbpath /data/db --replSet rs0 --bind_ip_all

# In another terminal, initialize it once:
mongosh --eval "rs.initiate()"
```
Then in `.env`:
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=clinic_app
DATABASE_URL=mongodb://localhost:27017/clinic_app?replicaSet=rs0
```
**Docker alternative:**
```bash
docker run -d --name clinic-mongo -p 27017:27017 mongo:7 --replSet rs0
docker exec -it clinic-mongo mongosh --eval "rs.initiate()"
```
**MongoDB Atlas:** create a free cluster; it is already a replica set. Use the
`mongodb+srv://…` URI (including the database name) for both `MONGO_URL` and
`DATABASE_URL`.

---

## 7. One-command reference

```bash
cp .env.example .env    # 1) configure
yarn install            # 2) dependencies (use yarn, not npm)
yarn setup              # 3) prisma generate + db push + seed demo + catalogs
yarn dev                # 4) run in dev (http://localhost:3000)
# production:
yarn build && yarn start
```

Default demo admin login is shown on the login screen while
`ALLOW_DEMO_LOGIN=true`. After first admin login you land on **/setup**.

---

## 8. Other compatible platforms

This is a standard Next.js 15 (Node) app with a MongoDB backend, so it also runs
on:

- **Vercel** — set all env vars in Project Settings; use MongoDB **Atlas** (managed
  replica set). Note: some long-running/start-script steps may need to run as a
  one-off (`yarn setup`) against Atlas before first deploy.
- **Railway / Render / Fly.io / DigitalOcean App Platform** — Node service +
  managed MongoDB (or Atlas). Build: `yarn build`; Start: `yarn start`.
- **Docker / Docker Compose** — a `Dockerfile` and `docker-compose.yml` are
  included; point them at your Mongo replica set and pass the env vars.
- **AWS / GCP / Azure** — any Node 18+ host + Atlas or a self-managed Mongo
  replica set.
- **Self-hosted VPS** — Node 18+, a Mongo replica set, a reverse proxy (Nginx) and
  a process manager (pm2/systemd) running `yarn start`.

In all cases: provide the same environment variables, ensure MongoDB is a replica
set, and never hardcode URLs/ports.

---

## 9. Post-install verification

1. App loads at `NEXT_PUBLIC_BASE_URL`.
2. Staff login works (demo admin while `ALLOW_DEMO_LOGIN=true`).
3. Admin is redirected to **/setup**; finishing it re-themes the app.
4. Dropdowns (allergies, meds, diagnoses) are populated (catalogs seeded).
5. If `EMERGENT_LLM_KEY` is set: the portal assistant replies and AI slide
   generation works in `/setup`.

Need to re-brand later? **Settings → Branding & Deployment Setup** re-opens the
wizard anytime.
