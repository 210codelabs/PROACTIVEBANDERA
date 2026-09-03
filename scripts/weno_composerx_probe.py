"""
1) Register YOSVANI SOTO as the default Weno prescriber (idempotent).
2) Screenshot the admin prescriber directory.
3) Launch ComposeRx and PROBE the live iFrame DOM (button labels, input
   placeholders, visible text) to learn whether a guided compose flow is
   feasible. No prescription is signed/sent — this is read-only discovery.
"""
import os, json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
PID = "cms87vx850017l4ocyz5zfz89"
OUT = "/app/public/weno-evidence"
EXE = "/root/bin/chromium"
os.makedirs(OUT, exist_ok=True)
ADMIN = {"email": "admin@proactiveclinic.com", "password": "apex123"}

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
    ctx.add_init_script("try{localStorage.setItem('pclinic_cookie_consent','accepted')}catch(e){} try{sessionStorage.setItem('pc_queue_open','0')}catch(e){}")
    r = ctx.request.post(f"{BASE}/api/auth/login", data=ADMIN)
    print("login:", r.status)

    # --- register YOSVANI SOTO (idempotent) ---
    existing = ctx.request.get(f"{BASE}/api/admin/weno/prescribers").json().get("prescribers", [])
    have = any(pr.get("npi") == "1780459438" for pr in existing)
    if not have:
        rr = ctx.request.post(f"{BASE}/api/admin/weno/prescribers", data={
            "firstName": "Yosvani", "lastName": "Soto", "npi": "1780459438",
            "wenoEmail": "", "isDefault": True,
        })
        print("register prescriber:", rr.status, rr.text()[:200])
    else:
        print("prescriber already registered")

    page = ctx.new_page()

    # --- probe ComposeRx iframe ---
    page.goto(f"{BASE}/erx/prescribe/{PID}", wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(9000)  # let the external ComposeRx app render

    # find the weno frame
    weno = None
    for fr in page.frames:
        if "wenoexchange.com" in (fr.url or ""):
            weno = fr
            break
    print("frames:", [f.url[:60] for f in page.frames])
    if weno:
        try:
            btns = weno.eval_on_selector_all("button, input[type=submit], a.btn, .btn", "els => els.map(e => (e.innerText||e.value||'').trim()).filter(Boolean).slice(0,40)")
        except Exception as e:
            btns = f"err {e}"
        try:
            phs = weno.eval_on_selector_all("input, select, textarea", "els => els.map(e => (e.getAttribute('placeholder')||e.getAttribute('name')||e.getAttribute('id')||'').trim()).filter(Boolean).slice(0,60)")
        except Exception as e:
            phs = f"err {e}"
        try:
            labels = weno.eval_on_selector_all("label, h1, h2, h3, .field-label", "els => els.map(e => (e.innerText||'').trim()).filter(Boolean).slice(0,40)")
        except Exception as e:
            labels = f"err {e}"
        print("BUTTONS:", json.dumps(btns)[:1500])
        print("INPUTS:", json.dumps(phs)[:1500])
        print("LABELS:", json.dumps(labels)[:1500])
    else:
        print("NO weno frame found")

    b.close()
print("done")
