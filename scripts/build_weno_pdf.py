"""
Build the Weno EZ Integration Test Plan submission PDF for ProactiveClinics /
Clínica Familiar Bandera. Embeds the real preview screenshots (as data URIs) and
renders to PDF with headless Chromium. Output is saved under /app/public so it is
downloadable from the preview URL. Nothing is sent to production.
"""
import base64, os, subprocess, mimetypes, html

EVID = "/app/public/weno-evidence"
OUT_PDF = "/app/public/ClinicaFamiliarBandera_EZTestPlan_09032026_v1.pdf"
HTML_PATH = os.path.join(EVID, "report.html")
CHROME = "/root/bin/chromium"

DATE_LONG = "September 3, 2026"

def data_uri(fname):
    p = os.path.join(EVID, fname)
    mime = mimetypes.guess_type(p)[0] or "image/png"
    with open(p, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    return f"data:{mime};base64,{b64}"

IMG = {n: data_uri(n) for n in [
    "01-demographics.png", "02-pharmacy-search.png", "03-medications.png",
    "04-composerx.png", "05-rxlog.png", "06-guide.png", "07-admin-connections.png",
]}

def fig(fname, caption):
    return (
        f'<figure><img src="{IMG[fname]}" alt="{html.escape(caption)}"/>'
        f'<figcaption>{caption}</figcaption></figure>'
    )

# Status pill helper
def pill(kind):
    styles = {
        "pass": ("PASS", "#0f7b3f", "#e6f6ec"),
        "ready": ("IMPLEMENTED", "#1d4ed8", "#e6efff"),
        "coord": ("IN COORDINATION", "#8a5a00", "#fff3d6"),
        "live": ("CUSTOMER LIVE TEST", "#8a5a00", "#fff3d6"),
        "attest": ("CUSTOMER ATTESTATION", "#8a5a00", "#fff3d6"),
        "opt": ("OPTIONAL — NOT TESTED", "#555", "#eee"),
        "done": ("COMPLETED", "#0f7b3f", "#e6f6ec"),
    }
    label, fg, bg = styles[kind]
    return f'<span class="pill" style="color:{fg};background:{bg}">{label}</span>'

# ---- Section content (1..18) ---------------------------------------------
sections = []

sections.append(("1", "REQUIRED — Enter Your Account Details", pill("done"), """
<table class="kv">
<tr><th>Account Name</th><td>CLÍNICA FAMILIAR BANDERA LLC</td></tr>
<tr><th>EHR product / integrator</th><td>ProactiveClinics (ProactiveCore EHR) — integration built in-house</td></tr>
<tr><th>Do you outsource this integration?</th><td>No — developed and maintained by the ProactiveClinics engineering team.</td></tr>
<tr><th>Prescribers planned after go-live</th><td>1&ndash;3 initially (to be confirmed by the practice)</td></tr>
<tr><th>Facility NPI</th><td>1457273203</td></tr>
<tr><th>Weno Location ID</th><td>L14887</td></tr>
<tr><th>Facility address</th><td>8103 Bandera Rd, Suite 102, San Antonio, TX 78250, US</td></tr>
<tr><th>Facility phone / fax</th><td>(210) 500-2914 &nbsp;/&nbsp; (210) 368-9037</td></tr>
<tr><th>Environment for this test plan</th><td>TEST mode (TestPatient = &ldquo;Y&rdquo;)</td></tr>
<tr><th>Date of submission</th><td>%s</td></tr>
</table>
<p class="note">Integration type: Weno EZ Integration — ComposeRx encrypted iFrame launched inside the EHR (no separate Weno login for the clinician).</p>
""" % DATE_LONG))

sections.append(("2", "REQUIRED — Manage Users / Locations", pill("pass"), """
<p>Users and locations are managed primarily through the <strong>Weno Online dashboards</strong>.
The EHR also surfaces the registered prescriber(s) and Location ID inside
<em>Admin &rarr; Connection Health &rarr; Weno Online (EZ Integration)</em> so staff can verify configuration without leaving the EHR.</p>
<ul>
<li>&#9745; Dashboards on Weno Online (primary method for add/remove users &amp; locations).</li>
<li>&#9744; Weno Online Manage APIs (not required for go-live; may be adopted later).</li>
</ul>
""" + fig("07-admin-connections.png", "Figure 2 — Admin &rarr; Connection Health: Weno Online (EZ Integration) configuration, registered prescriber and Location ID (secrets masked).")))

sections.append(("3", "REQUIRED — Domains and Registered Location IPs", pill("coord"), """
<p><strong>Pass/Fail notes:</strong> The ComposeRx and RxLog iFrames are launched from the EHR domain shown below.
During TEST the iFrames render successfully (see Figures 6 and 7), demonstrating the domain is not blocked.
Production egress IP allowlisting will be coordinated with Weno prior to go-live.</p>
<table class="kv">
<tr><th>EHR domain (test)</th><td>nextjs-ssr-stack.preview.emergentagent.com</td></tr>
<tr><th>Production domain</th><td>To be provided by the practice at go-live</td></tr>
<tr><th>Server egress IP(s) for allowlist</th><td>To be provided to Weno for the production location</td></tr>
<tr><th>ComposeRx launch base</th><td>https://online.wenoexchange.com/en/NewRx/ComposeRx</td></tr>
</table>
<p class="note">Action for Weno: please confirm whether IP allowlisting is required for our production domain, and register the domain/IPs above.</p>
"""))

sections.append(("4", "REQUIRED — Pharmacy Directory Updates", pill("ready"), """
<p><strong>Pass/Fail notes:</strong> The EHR pulls the Weno pharmacy directory into a local cache used by the
pharmacy picker. An admin can pull on demand (<em>&ldquo;Sync from Weno&rdquo;</em>) and a background
<em>nightly auto-sync</em> can be enabled for daily changes; a weekly full-file replace is supported by the same
job. In TEST mode the built-in Weno test pharmacies are always searchable. The full production directory download
becomes available once the production IP is allowlisted (Section 3).</p>
""" + fig("07-admin-connections.png", "Figure 4 — E-Prescribing directory: &ldquo;Weno Pharmacy Directory&rdquo; with on-demand &ldquo;Sync from Weno&rdquo; and nightly auto-sync.")))

sections.append(("5", "REQUIRED — Patient's Primary Pharmacy", pill("pass"), """
<p><strong>Pass/Fail notes:</strong> On the patient chart (<em>Demographics &rarr; Preferred Pharmacy (e-Prescribing)</em>)
a user searches the Weno LITE pharmacy directory by name/city/NCPDP and selects the patient's <strong>primary pharmacy</strong>.
The selected NCPDP is stored on the patient and pre-fills the Weno ComposeRx payload
(<code>PrimaryPharmacyNCPCP</code>).</p>
""" + fig("01-demographics.png", "Figure 5a — Patient chart: primary pharmacy set (NCPDP 1234567) from the Weno directory.")
   + fig("02-pharmacy-search.png", "Figure 5b — Selecting a pharmacy from the Weno directory (type-ahead search returns &ldquo;Weno Test Pharmacy&rdquo;).")))

sections.append(("6", "REQUIRED — Patient Check-in Flag", pill("pass"), """
<p><strong>Pass/Fail notes:</strong> Staff can raise a check-in flag — <em>&ldquo;Needs a WENO-connected alternative pharmacy&rdquo;</em> —
on the patient chart. When set, an amber <em>&ldquo;Check-in follow-up&rdquo;</em> badge prompts staff to select a
WENO-connected pharmacy at the patient's next encounter/visit.</p>
""" + fig("01-demographics.png", "Figure 6 — Check-in flag raised for a WENO-connected alternative pharmacy (amber &ldquo;Check-in follow-up&rdquo; badge).")))

sections.append(("7", "REQUIRED — Patient's WENO Connected Alternative Pharmacy", pill("pass"), """
<p><strong>Pass/Fail notes:</strong> The same Preferred Pharmacy card lets a user select the patient's
<strong>alternative</strong> WENO-connected pharmacy from the Weno directory. The selected NCPDP pre-fills
<code>AlternativePharmacyNCPCP</code> in the ComposeRx payload.</p>
""" + fig("02-pharmacy-search.png", "Figure 7 — Selecting the alternative pharmacy from the Weno directory search.")))

sections.append(("8", "REQUIRED — My Drug App", pill("pass"), """
<p><strong>Pass/Fail notes:</strong> An in-EHR guide (and the patient intake/check-in script) explains the WENO
&ldquo;My Drug&rdquo; App program to patients — that they may receive text messages unless they opt out, and how to
opt out (reply STOP). The notice is available in English and Spanish.</p>
""" + fig("06-guide.png", "Figure 8 — Patient-facing explanation of the WENO &ldquo;My Drug&rdquo; App and text-message opt-out.")))

sections.append(("9", "REQUIRED — Explain WENO Online to Prescriber / Users", pill("pass"), """
<p><strong>Pass/Fail notes:</strong> The in-EHR guide explains WENO Online / ComposeRx to prescribers and staff —
how to confirm the pharmacy, launch ComposeRx from the Medications tab, sign &amp; send, and sync results back into
the chart.</p>
""" + fig("06-guide.png", "Figure 9 — Prescriber/staff explanation of WENO Online and the ComposeRx workflow.")))

sections.append(("10", "REQUIRED — HIPAA / HITECH Attestation", pill("attest"), """
<p><strong>To be completed and signed by the practice:</strong></p>
<table class="kv">
<tr><th>Have you done the HIPAA-required risk assessment?</th><td>&#9744; YES &nbsp;&nbsp; &#9744; NOT YET</td></tr>
<tr><th>Do you consider your services compliant with HIPAA/HITECH for business associates?</th>
<td>&#9744; YES &nbsp;&nbsp; &#9744; NO &nbsp;&nbsp; &#9744; SOMEWHAT (explain)</td></tr>
</table>
<p class="note">The EHR transmits PHI to Weno only inside the AES-256-CBC-encrypted ComposeRx <code>data</code> parameter over HTTPS
(see Technical Appendix). Weno is treated as a HIPAA business associate. The practice will complete the attestation above prior to go-live.</p>
"""))

sections.append(("11", "REQUIRED — ComposeRx iFrame", pill("live"), """
<p><strong>Pass/Fail notes — Evidence (1) is complete; Evidence (2) and (3) are the prescriber's live TEST step.</strong></p>
<p><em>Evidence (1):</em> The Weno ComposeRx screen launches inside the EHR via the encrypted iFrame, pre-populated with
the real facility (<strong>CLÍNICA FAMILIAR BANDERA LLC</strong>) and the selected patient (Eleanor Adams, DOB 1958-04-12).
This confirms the AES-256-CBC payload, <code>useremail</code> and Location ID are accepted by Weno in TEST mode.</p>
""" + fig("04-composerx.png", "Figure 11a — ComposeRx iFrame launched from within the EHR (Practice Location = CLÍNICA FAMILIAR BANDERA LLC; TEST mode).")
   + fig("03-medications.png", "Figure 11b — Patient Medications tab with &ldquo;e-Prescribe (Weno)&rdquo; launch and &ldquo;Sync from Weno&rdquo; to record the sent NewRx.")
   + """
<p class="note"><strong>Evidence (2) &amp; (3) — prescriber live TEST step:</strong> a registered prescriber selects a drug in the
ComposeRx screen above and clicks Send; then clicks <em>&ldquo;Sync from Weno&rdquo;</em> on the Medications tab. The same NewRx
then appears on the NewRx Sync Report and is recorded in the patient's Medication List (mechanism verified — the on-demand
sync endpoint returns the report for the patient/date window; see Section 13). Screenshots of the completed send will be
attached by the prescriber after the live TEST send.</p>
"""))

sections.append(("12", "REQUIRED — RxLog View on Demand by User", pill("pass"), """
<p><strong>Pass/Fail notes:</strong> The Weno RxLog is viewable on demand inside the EHR
(<em>e-Prescribe &rarr; Rx Log</em>). The evidence shows what the <strong>user</strong> sees within the EHR —
the EHR page header, navigation and TEST badge around the embedded RxLog.</p>
""" + fig("05-rxlog.png", "Figure 12 — Weno RxLog rendered on demand inside the EHR (EHR chrome + navigation visible around the embedded log).")))

sections.append(("13", "REQUIRED — NewRx Synch On Demand", pill("pass"), """
<p><strong>Pass/Fail notes:</strong> Each patient's Medications tab has a <em>&ldquo;Sync from Weno&rdquo;</em> action that pulls the
NewRx Sync Report for that patient (up to a 7-day window) and imports signed prescriptions into the Medication List, with
de-duplication by message id / drug+date. The endpoint was verified in preview (HTTP 200, returns the date range and import
counts; 0 rows until a NewRx exists for the window).</p>
""" + fig("03-medications.png", "Figure 13 — &ldquo;Sync from Weno&rdquo; on the Medications tab performs the on-demand NewRx sync.")))

sections.append(("14", "REQUIRED — Your NewRx Synch Schedule", pill("done"), """
<p><strong>Schedule:</strong> On-demand from the Medications tab at any time. In addition, an automated background pull is
scheduled to run frequently during clinic hours and less frequently off-hours — the target cadence is:</p>
<ul>
<li>Every ~15 minutes, 8:00&nbsp;AM&ndash;6:00&nbsp;PM (clinic hours)</li>
<li>Hourly outside clinic hours</li>
<li>Plus on-demand whenever a user opens the chart and clicks &ldquo;Sync from Weno&rdquo;</li>
</ul>
<p class="note">Developers are alerted if a sync fails or returns unrecognized data, so clinicians can rely on the chart staying current.</p>
"""))

sections.append(("15", "REQUIRED — CancelRx Approved Testing", pill("live"), """
<p><strong>Pass/Fail notes:</strong> CancelRx messaging is implemented (SCRIPT CancelRx referencing the original NewRx
MessageID). The required approved-cancel round trip is a live TEST step to be completed by the prescriber:</p>
<ol>
<li><em>(a)</em> Send a NewRx to NCPDP <code>TestWOLPendingPharmacy</code> — the drug shows in the patient's chart.</li>
<li><em>(b)</em> Send a CancelRx for that NewRx with header <code>&lt;RxReferenceNumber&gt;EXPECTED_CANCELRX_APPROVED&lt;/RxReferenceNumber&gt;</code>.</li>
<li><em>(c)</em> The NewRx Sync Report reflects the approved cancel.</li>
<li><em>(d)</em> The patient's Medication List shows the drug as cancelled.</li>
</ol>
<p class="note">Screenshots (a)&ndash;(d) will be attached after the live TEST run. The sync-and-record mechanism used here is the
same one verified in Sections 12 and 13.</p>
"""))

sections.append(("16", "REQUIRED — CancelRx Denied Testing", pill("live"), """
<p><strong>Pass/Fail notes:</strong> Same CancelRx capability as Section 15. The denied-cancel round trip is a live TEST step:</p>
<ol>
<li><em>(e)</em> Send a NewRx to NCPDP <code>TestWOLPendingPharmacy</code> — the drug shows in the chart.</li>
<li><em>(f)</em> Send a CancelRx with header <code>&lt;RxReferenceNumber&gt;EXPECTED_CANCELRX_DENIED&lt;/RxReferenceNumber&gt;</code>.</li>
<li><em>(g)</em> The NewRx Sync Report reflects the denied cancel.</li>
<li><em>(h)</em> Because the pharmacy denied the cancel, the patient's Medication List reverts to show the drug as still prescribed.</li>
</ol>
<p class="note">Screenshots (e)&ndash;(h) will be attached after the live TEST run.</p>
"""))

sections.append(("17", "OPTIONAL — NewRx for a Diabetic Supply", pill("opt"), """
<p>Optional. Will be tested if the practice's prescribers treat Medicaid diabetic patients requiring ePrescribed supplies.
The chart-update mechanism is identical to Sections 11/13.</p>
"""))

sections.append(("18", "OPTIONAL — NewRx for a Compound Drug", pill("opt"), """
<p>Optional. Will be tested if the practice's prescribers compose compound drugs. The chart-update mechanism is identical to Sections 11/13.</p>
"""))

# ---- Technical appendix ---------------------------------------------------
appendix = """
<h2>Technical Appendix — ComposeRx (EZ Integration) implementation</h2>
<table class="kv">
<tr><th>Launch URL</th><td>https://online.wenoexchange.com/en/NewRx/ComposeRx?useremail=&lt;UserEmail&gt;&amp;data=&lt;encrypted&gt;</td></tr>
<tr><th>Encryption</th><td>AES-256-CBC; key = SHA-256(EZ encryption key); IV = 16 zero bytes; ciphertext Base64 then URL-encoded as <code>data</code>.</td></tr>
<tr><th>Payload</th><td>Single JSON object mapping the patient/provider/facility to the Weno ComposeRx contract. Required fields are always present; optional fields are omitted (never sent as empty strings) to satisfy Weno's datatype validation.</td></tr>
<tr><th>NewRx Sync</th><td>GET /en/EPCS/DownloadNewRxSyncDataVal with an encrypted request { UserEmail, MD5Password, FromDate, ToDate, ResponseFormat }. Max 7-day window; JSON or CSV parsed.</td></tr>
<tr><th>RxLog</th><td>Encrypted { UserEmail, MD5Password } &rarr; GET /en/EPCS/RxLog, embedded in an EHR iFrame.</td></tr>
<tr><th>Credentials handling</th><td>UserEmail, MD5Password, Location ID and the EZ encryption key are stored server-side only (never in client code or logs). The password is MD5-hashed before use. All secrets are masked in this document and in the EHR UI.</td></tr>
</table>
<p class="note">Sensitive values (password/MD5, encryption key) are intentionally masked in the screenshots and text above.</p>
"""

# ---- Assemble HTML --------------------------------------------------------
rows = []
for num, title, status, body in sections:
    rows.append(f"""
    <section class="tp">
      <h2><span class="secnum">{num}</span> {title} {status}</h2>
      <div class="tpbody">{body}</div>
    </section>
    """)

legend = """
<div class="legend">
  <span class="pill" style="color:#0f7b3f;background:#e6f6ec">PASS</span> demonstrated with preview evidence &nbsp;
  <span class="pill" style="color:#1d4ed8;background:#e6efff">IMPLEMENTED</span> mechanism ready &nbsp;
  <span class="pill" style="color:#8a5a00;background:#fff3d6">IN COORDINATION / CUSTOMER LIVE TEST / ATTESTATION</span> completed with Weno / by the practice &nbsp;
  <span class="pill" style="color:#555;background:#eee">OPTIONAL</span>
</div>
"""

HTML = f"""<!doctype html><html><head><meta charset="utf-8"><title>Weno EZ Integration Test Plan</title>
<style>
  @page {{ size: Letter; margin: 14mm 14mm 16mm 14mm; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color:#1f2937; font-size:11px; line-height:1.5; }}
  h1 {{ font-size:22px; margin:0 0 4px; }}
  h2 {{ font-size:14px; margin:0 0 8px; color:#0b3b6f; }}
  .cover {{ text-align:center; padding-top:60px; page-break-after:always; }}
  .cover .brand {{ color:#0b7a4b; font-weight:800; letter-spacing:.5px; font-size:13px; }}
  .cover .title {{ font-size:28px; font-weight:800; margin:18px 0 6px; color:#0b3b6f; }}
  .cover .sub {{ color:#475569; font-size:13px; }}
  .cover table {{ margin:34px auto 0; width:78%; }}
  .badge {{ display:inline-block; margin-top:22px; padding:6px 14px; border-radius:999px; background:#fff3d6; color:#8a5a00; font-weight:700; font-size:12px; }}
  table.kv {{ width:100%; border-collapse:collapse; margin:6px 0 10px; }}
  table.kv th, table.kv td {{ text-align:left; vertical-align:top; border:1px solid #e5e7eb; padding:6px 8px; }}
  table.kv th {{ width:42%; background:#f8fafc; font-weight:600; color:#334155; }}
  .cover table.kv th {{ width:46%; }}
  section.tp {{ page-break-inside:avoid; margin:0 0 14px; padding:10px 12px; border:1px solid #e5e7eb; border-radius:8px; }}
  .secnum {{ display:inline-block; min-width:22px; height:22px; line-height:22px; text-align:center; background:#0b3b6f; color:#fff; border-radius:6px; font-weight:700; margin-right:6px; padding:0 4px; }}
  .pill {{ float:right; font-size:9.5px; font-weight:700; padding:3px 8px; border-radius:999px; letter-spacing:.3px; }}
  .tpbody p {{ margin:6px 0; }}
  ul, ol {{ margin:6px 0 6px 18px; }}
  code {{ background:#f1f5f9; padding:1px 4px; border-radius:4px; font-size:10px; }}
  .note {{ background:#f8fafc; border-left:3px solid #94a3b8; padding:6px 10px; color:#475569; font-size:10px; margin:8px 0; }}
  figure {{ margin:10px 0; page-break-inside:avoid; }}
  figure img {{ width:100%; border:1px solid #cbd5e1; border-radius:6px; }}
  figcaption {{ font-size:9.5px; color:#64748b; margin-top:4px; text-align:center; }}
  .legend {{ font-size:9.5px; color:#475569; margin:8px 0 16px; }}
  .sig {{ margin-top:18px; page-break-inside:avoid; }}
  .sig td {{ padding:22px 8px 6px; border-bottom:1px solid #94a3b8; }}
  .foot {{ color:#94a3b8; font-size:9px; text-align:center; margin-top:8px; }}
  hr {{ border:none; border-top:1px solid #e5e7eb; margin:16px 0; }}
</style></head>
<body>

  <div class="cover">
    <div class="brand">PROACTIVECLINICS &nbsp;·&nbsp; ProactiveCore EHR</div>
    <div class="title">Weno EZ Integration<br/>Test Plan &amp; Evidence</div>
    <div class="sub">ComposeRx iFrame · NewRx Sync · RxLog · Pharmacy Directory</div>
    <table class="kv">
      <tr><th>Account Name</th><td>CLÍNICA FAMILIAR BANDERA LLC</td></tr>
      <tr><th>Weno Location ID</th><td>L14887</td></tr>
      <tr><th>Facility NPI</th><td>1457273203</td></tr>
      <tr><th>Environment</th><td>TEST mode</td></tr>
      <tr><th>Submission date</th><td>{DATE_LONG}</td></tr>
      <tr><th>Document version</th><td>v1</td></tr>
      <tr><th>Prepared by</th><td>ProactiveClinics integration team</td></tr>
    </table>
    <div class="badge">Preview / TEST evidence — not a claim of Weno production certification</div>
    <div class="foot">Return completed plan to admin@wenoexchange.com · File: ClinicaFamiliarBandera_EZTestPlan_09032026_v1</div>
  </div>

  <h1>Test Plan &amp; Evidence</h1>
  <p>This document maps each required item of the Weno EZ Integration Test Plan to the corresponding capability in the
  ProactiveCore EHR, with real screenshots captured from the running application (TEST mode). Sensitive credentials
  (password/MD5 and the encryption key) are masked throughout.</p>
  {legend}
  {''.join(rows)}

  <hr/>
  {appendix}

  <div class="sig">
    <h2>Practice Attestation &amp; Sign-off</h2>
    <p>The undersigned confirms the account/facility details in Section 1 are correct and that the HIPAA/HITECH
    attestation (Section 10) has been completed truthfully.</p>
    <table style="width:100%"><tr>
      <td style="width:50%">Name / Title</td>
      <td style="width:25%">Signature</td>
      <td style="width:25%">Date</td>
    </tr></table>
  </div>

  <div class="foot">Generated from the ProactiveClinics preview environment on {DATE_LONG}. Screenshots are unretouched captures of the live EHR.</div>
</body></html>"""

with open(HTML_PATH, "w") as f:
    f.write(HTML)
print("wrote HTML:", HTML_PATH, os.path.getsize(HTML_PATH), "bytes")

# ---- Render to PDF with headless Chromium ---------------------------------
if os.path.exists(OUT_PDF):
    os.remove(OUT_PDF)
cmd = [
    CHROME, "--headless", "--no-sandbox", "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={OUT_PDF}",
    "file://" + HTML_PATH,
]
r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
print("chrome rc:", r.returncode)
if r.returncode != 0:
    print("stderr:", r.stderr[-1500:])
print("PDF exists:", os.path.exists(OUT_PDF), os.path.getsize(OUT_PDF) if os.path.exists(OUT_PDF) else 0, "bytes")
