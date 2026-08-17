/* Capture real preview screenshots (logged in) for the User Guide.
   Uses the existing Chromium via puppeteer-core against the HTTPS preview URL
   (Secure session cookie requires HTTPS). Saves PNGs to public/guide/shots.
   Run: node scripts/capture-guide-shots.cjs */
const fs = require("node:fs");
const puppeteer = require("puppeteer-core");

const EXECS = ["/root/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/chromium"];
const execPath = EXECS.find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });

// base URL from /app/.env
let BASE = "https://nextjs-ssr-stack.preview.emergentagent.com";
try {
  const env = fs.readFileSync("/app/.env", "utf8");
  const m = env.match(/NEXT_PUBLIC_BASE_URL\s*=\s*(.*)/);
  if (m) BASE = m[1].trim().replace(/^["']|["']$/g, "").replace(/\/$/, "");
} catch {}

const EMAIL = "admin@proactiveclinic.com";
const PASSWORD = "apex123";
const OUT = "/app/public/guide/shots";
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["/dashboard", "dashboard"],
  ["/schedule", "schedule"],
  ["/schedule?view=day", "schedule-day"],
  ["/patients", "patients"],
  ["/patients/new", "patient-new"],
  ["/encounters", "encounters"],
  ["/orders", "orders"],
  ["/billing", "billing"],
  ["/billing/revenue-cycle", "revenue-cycle"],
  ["/billing/eligibility-report", "eligibility"],
  ["/records-requests", "records-requests"],
  ["/settings", "settings"],
  ["/settings/ehi-export", "ehi-export"],
];
const PUBLIC_PAGES = [
  ["/", "landing"],
  ["/book", "book"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dismissCookie(page) {
  try {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const accept = btns.find((b) => /accept/i.test(b.textContent || ""));
      if (accept) accept.click();
    });
  } catch {}
}

async function shot(page, path, name) {
  try {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(2600);
    await dismissCookie(page);
    await sleep(600);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    console.log("OK", name);
    return true;
  } catch (e) {
    console.log("FAIL", name, e.message);
    return false;
  }
}

(async () => {
  if (!execPath) { console.error("No chromium binary found"); process.exit(1); }
  console.log("Using", execPath, "BASE", BASE);
  const browser = await puppeteer.launch({
    executablePath: execPath,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--hide-scrollbars"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  // LOGIN
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 45000 });
  await sleep(1500);
  await dismissCookie(page);
  await page.type("input[type=email]", EMAIL, { delay: 15 });
  await page.type("input[type=password]", PASSWORD, { delay: 15 });
  await Promise.all([
    page.click("button[type=submit]"),
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {}),
  ]);
  await sleep(3000);
  console.log("after login url=", page.url());

  for (const [p, n] of PAGES) await shot(page, p, n);

  // patient chart
  try {
    await page.goto(BASE + "/patients", { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(2500);
    const href = await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a[href^='/patients/']"))
        .map((x) => x.getAttribute("href"))
        .find((h) => h && h !== "/patients/new" && !h.includes("/new"));
      return a || null;
    });
    if (href) { await shot(page, href, "patient-chart"); }
    else console.log("NO_PATIENT_LINK");
  } catch (e) { console.log("CHART_FAIL", e.message); }

  // public pages (still fine while logged in)
  for (const [p, n] of PUBLIC_PAGES) await shot(page, p, n);

  await browser.close();
  const files = fs.readdirSync(OUT);
  console.log("DONE", files.length, "files:", files.join(", "));
})().catch((e) => { console.error(e); process.exit(1); });
