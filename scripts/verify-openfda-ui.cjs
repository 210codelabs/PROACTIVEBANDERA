/* Verify openFDA UI (typeahead + inventory FDA-vs-stock) against HTTPS preview. */
const fs = require("node:fs");
const puppeteer = require("puppeteer-core");
const EXECS = ["/root/bin/chromium", "/usr/bin/google-chrome"];
const execPath = EXECS.find((p) => { try { fs.accessSync(p); return true; } catch { return false; } });
let BASE = "https://nextjs-ssr-stack.preview.emergentagent.com";
try { const e = fs.readFileSync("/app/.env","utf8").match(/NEXT_PUBLIC_BASE_URL\s*=\s*(.*)/); if (e) BASE = e[1].trim().replace(/^["']|["']$/g,"").replace(/\/$/,""); } catch {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({ executablePath: execPath, headless: "new", args: ["--no-sandbox","--disable-dev-shm-usage","--disable-gpu","--hide-scrollbars"] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await p.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 45000 });
  await sleep(1200);
  await p.type("input[type=email]", "admin@proactiveclinic.com", { delay: 12 });
  await p.type("input[type=password]", "apex123", { delay: 12 });
  await Promise.all([ p.click("button[type=submit]"), p.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(()=>{}) ]);
  await sleep(2500);
  console.log("after login:", p.url());

  // Inventory FDA lookup
  await p.goto(BASE + "/inventory", { waitUntil: "domcontentloaded", timeout: 45000 });
  await sleep(2500);
  try {
    await p.waitForSelector("input[placeholder*='label']", { timeout: 8000 });
    await p.type("input[placeholder*='label']", "lisinopril", { delay: 20 });
    await sleep(2800); // debounce + openFDA
    // click first dropdown result
    const clicked = await p.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const hit = btns.find(x => /lisinopril/i.test(x.textContent||"") && x.className.includes("text-left"));
      if (hit) { hit.click(); return true; } return false;
    });
    await sleep(3500); // NDC + label fetch
    console.log("inv result clicked:", clicked);
  } catch (e) { console.log("inv typeahead err:", e.message); }
  await p.screenshot({ path: "/tmp/ofda_inv.png", fullPage: false });

  // New Rx order for first patient
  try {
    await p.goto(BASE + "/patients", { waitUntil: "domcontentloaded", timeout: 45000 });
    await sleep(2200);
    const href = await p.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a[href^='/patients/']")).map(x=>x.getAttribute("href")).find(h=>h && h!=="/patients/new" && !h.includes("/new"));
      return a || null;
    });
    if (href) {
      await p.goto(BASE + href + "/orders/new?type=rx", { waitUntil: "domcontentloaded", timeout: 45000 });
      await sleep(2500);
      await p.waitForSelector("input[placeholder*='openFDA']", { timeout: 8000 });
      await p.type("input[placeholder*='openFDA']", "atorvastatin", { delay: 20 });
      await sleep(2800);
      await p.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const hit = btns.find(x => /atorvastatin/i.test(x.textContent||"") && x.className.includes("text-left"));
        if (hit) hit.click();
      });
      await sleep(2500);
      console.log("rx page:", p.url());
    } else console.log("no patient link");
  } catch (e) { console.log("rx err:", e.message); }
  await p.screenshot({ path: "/tmp/ofda_rx.png", fullPage: false });

  await b.close();
  console.log("DONE");
})().catch(e => { console.error(e); process.exit(1); });
