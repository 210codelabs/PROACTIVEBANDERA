"""
Capture real preview screenshots for the Weno EZ Integration test-plan submission.
Saves PNGs to /app/public/weno-evidence/. Logs in as admin via the API so the
session cookie is shared with the browser context.
"""
import os
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
PID = "cms87vx850017l4ocyz5zfz89"  # Eleanor Adams (demo/test patient)
OUT = "/app/public/weno-evidence"
EXE = "/root/bin/chromium"
os.makedirs(OUT, exist_ok=True)

ADMIN = {"email": "admin@proactiveclinic.com", "password": "apex123"}

results = []

def shot(page, name, full=True):
    path = os.path.join(OUT, name)
    try:
        page.screenshot(path=path, full_page=full)
        print(f"[ok] {name}")
        results.append((name, True))
    except Exception as e:
        print(f"[ERR] {name}: {e}")
        results.append((name, False))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2)

    # Pre-dismiss the cookie banner and collapse the floating live-queue panel so
    # they do not overlap the evidence screenshots.
    ctx.add_init_script(
        """
        try { localStorage.setItem('pclinic_cookie_consent', 'accepted'); } catch (e) {}
        try { sessionStorage.setItem('pc_queue_open', '0'); } catch (e) {}
        """
    )

    # --- login (shares cookie jar with the context) ---
    r = ctx.request.post(f"{BASE}/api/auth/login", data=ADMIN)
    print("login status:", r.status)

    page = ctx.new_page()

    def go(path, waits=1500):
        page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(waits)

    # 1) Demographics — pharmacy card (primary set + check-in flag) => sections 5,6,7
    go(f"/patients/{PID}/demographics", 2500)
    shot(page, "01-demographics.png")

    # 2) Pharmacy directory search dropdown => sections 5/7 ("how a user selects")
    try:
        inp = page.get_by_placeholder("Search Weno pharmacy directory by name, city, or NCPDP…").first
        inp.scroll_into_view_if_needed()
        inp.click()
        inp.fill("Weno")
        page.wait_for_timeout(2000)  # debounce + fetch
        # capture the pharmacy card region + dropdown (viewport)
        page.wait_for_timeout(500)
        shot(page, "02-pharmacy-search.png", full=False)
    except Exception as e:
        print("[warn] pharmacy search:", e)
        shot(page, "02-pharmacy-search.png", full=False)

    # 3) Medications — Sync from Weno + e-Prescribe(Weno) + list => sections 11,13 (EHR chart)
    go(f"/patients/{PID}/medications", 2500)
    shot(page, "03-medications.png")

    # 4) ComposeRx iFrame launched inside the EHR => section 11 (iFrame)
    go(f"/erx/prescribe/{PID}", 7000)
    shot(page, "04-composerx.png")

    # 5) Rx Log view on demand inside the EHR => section 12
    go("/erx/rxlog", 7000)
    shot(page, "05-rxlog.png")

    # 6) e-Prescribing guide (WENO Online + My Drug App + check-in flag) => sections 8,9,6
    go("/erx/guide", 1800)
    shot(page, "06-guide.png")

    # 7) Admin connections — Weno config + pharmacy directory sync => sections 3,4
    go("/admin/connections", 3000)
    shot(page, "07-admin-connections.png")

    b.close()

print("\n=== SUMMARY ===")
for n, ok in results:
    print(("OK " if ok else "FAIL"), n)
