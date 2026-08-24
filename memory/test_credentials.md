# Test Credentials
# Agent writes here when creating/modifying auth credentials (admin accounts, test users).
# Testing agent reads this before auth tests. Fork/continuation agents read on startup.

## Staff / EHR login (demo roster enabled via ALLOW_DEMO_LOGIN=true)
- Owner admin:         ernesto@210codelabs.com / Proactive2025!   (self-healing via OWNER_ADMIN_* env; created in preview 2026-08)
- Provider (default): andy.manzano@proactiveclinic.com / apex123
- Admin:              admin@proactiveclinic.com / apex123
- Nurse:              nurse.kim@proactiveclinic.com / apex123
- Front desk:         front.lopez@proactiveclinic.com / apex123
- Billing:            billing@proactiveclinic.com / apex123
Login page: /login  (staff). All EHR routes under /(app) and protected /api/* require this session cookie.

## Patient Portal login
- MRN: PC-100000  DOB: 1958-04-12  (Eleanor Adams)
Portal login also available from the landing hero "Patient Portal" tab and inside Kiosk Mode (/kiosk).

## Attorney Portal login (/attorney)
- Email: attorney@example.com   Access code: PROLAW2025   (Jordan Vega, Vega & Associates)
Attorneys submit record requests; staff approve them at /records-requests (EHR). Approved requests are downloadable from the attorney portal.



## Enterprise / Corporate Portal (occupational health) — /enterprise/login
- hr@lonestarlogistics.com / demo1234  (Lone Star Logistics — Company Admin)
- safety@alamomfg.com / demo1234  (Alamo Manufacturing Co. — Company Admin)
- SUPER ADMIN (All-Mighty): any EMR staff admin can also log into /enterprise/login with their EMR password → e.g. admin@proactiveclinic.com / apex123 → sees all companies.
Admin management of these accounts: staff admin (admin@proactiveclinic.com) at /admin/enterprise
