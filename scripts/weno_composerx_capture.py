"""
Capture two more real evidence shots (non-destructive — nothing is signed/sent):
  08-prescriber-registered.png  — admin Weno prescriber directory with YOSVANI SOTO
  09-composerx-compose.png      — ComposeRx compose form populated & ready to sign
"""
import os
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
PID = "cms87vx850017l4ocyz5zfz89"
OUT = "/app/public/weno-evidence"
EXE = "/root/bin/chromium"
ADMIN = {"email": "admin@proactiveclinic.com", "password": "apex123"}

def save(page, name, full=True):
    try:
        page.screenshot(path=os.path.join(OUT, name), full_page=full)
        print("[ok]", name)
    except Exception as e:
        print("[ERR]", name, e)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    ctx.add_init_script("try{localStorage.setItem('pclinic_cookie_consent','accepted')}catch(e){} try{sessionStorage.setItem('pc_queue_open','0')}catch(e){}")
    print("login:", ctx.request.post(f"{BASE}/api/auth/login", data=ADMIN).status)
    page = ctx.new_page()

    # 8) Admin prescriber directory — scroll to the "Weno-registered prescribers" block
    page.goto(f"{BASE}/admin/connections", wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(3000)
    try:
        el = page.get_by_text("Weno-registered prescribers", exact=False).first
        el.scroll_into_view_if_needed()
        page.wait_for_timeout(1200)
    except Exception as e:
        print("scroll prescribers:", e)
    save(page, "08-prescriber-registered.png", full=False)

    # 9) ComposeRx compose form — populate (drug, SIG, qty, refills, days) but DO NOT submit
    page.goto(f"{BASE}/erx/prescribe/{PID}", wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(9000)
    weno = next((f for f in page.frames if "wenoexchange.com" in (f.url or "")), None)
    if weno:
        def try_fill(selector, value, desc):
            try:
                loc = weno.locator(selector).first
                loc.scroll_into_view_if_needed(timeout=4000)
                loc.fill(value, timeout=4000)
                print("filled", desc)
                return True
            except Exception as e:
                print("skip", desc, str(e)[:80])
                return False
        # drug search
        try_fill("input[placeholder='Search drug']", "Lisinopril 10 mg tablet", "drug")
        try:
            weno.get_by_role("button", name="Search").first.click(timeout=3000)
            page.wait_for_timeout(2500)
            print("clicked Search")
        except Exception as e:
            print("search click skip", str(e)[:80])
        # SIG / refills / days / qty
        try_fill("textarea[placeholder='Enter SIG/Directions for Patient Here']", "Take 1 tablet by mouth once daily", "sig")
        try_fill("input[name='Medication[0].RefillsValue']", "2", "refills")
        try_fill("input[name='Medication[0].DaysSupply']", "30", "days")
        page.wait_for_timeout(800)
    else:
        print("no weno frame")
    save(page, "09-composerx-compose.png", full=False)
    # also a full-page version for context
    save(page, "09b-composerx-compose-full.png", full=True)

    b.close()
print("done")
