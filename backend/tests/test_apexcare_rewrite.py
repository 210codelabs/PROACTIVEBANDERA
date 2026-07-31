"""ApexCare EHR — Rewrite (FastAPI + MongoDB + React SPA) API tests."""
import os
import uuid
import requests
import pytest

BASE = os.environ.get(
    "preview_endpoint",
    "https://b1752a43-8a73-4c36-8236-baf5447ca081.preview.emergentagent.com",
).rstrip("/")


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(
        f"{BASE}/api/auth/login",
        json={"email": "admin@apexcare.health", "password": "apex123"},
        timeout=15,
        verify=False,
    )
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True
    assert "apexcare_session" in s.cookies.get_dict()
    return s


@pytest.fixture(scope="module")
def provider_session():
    s = requests.Session()
    r = s.post(
        f"{BASE}/api/auth/login",
        json={"email": "mariuska.aristica@apexcare.health", "password": "apex123"},
        timeout=15,
        verify=False,
    )
    assert r.status_code == 200
    return s


# ---------------------------------------------------------------- SPA & health
class TestSPA:
    def test_index_html(self):
        r = requests.get(f"{BASE}/", timeout=15, verify=False)
        assert r.status_code == 200
        assert "<div id=\"root\"" in r.text or "root" in r.text

    def test_hash_route_serves_spa(self):
        # HashRouter -> non-hash server route always returns SPA
        r = requests.get(f"{BASE}/login", timeout=15, verify=False)
        assert r.status_code == 200

    def test_health(self):
        r = requests.get(f"{BASE}/api/health", timeout=15, verify=False)
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ---------------------------------------------------------------- Staff auth
class TestStaffAuth:
    def test_login_bad_password(self):
        r = requests.post(
            f"{BASE}/api/auth/login",
            json={"email": "admin@apexcare.health", "password": "wrong"},
            timeout=15,
            verify=False,
        )
        assert r.status_code == 401

    def test_login_unknown_email(self):
        r = requests.post(
            f"{BASE}/api/auth/login",
            json={"email": "nope@example.com", "password": "apex123"},
            timeout=15,
            verify=False,
        )
        assert r.status_code == 401

    def test_me_unauthorized(self):
        r = requests.get(f"{BASE}/api/auth/me", timeout=15, verify=False)
        assert r.status_code == 401

    def test_login_me_refresh_logout(self, admin_session):
        r = admin_session.get(f"{BASE}/api/auth/me", timeout=15, verify=False)
        assert r.status_code == 200
        user = r.json()["user"]
        assert user["email"] == "admin@apexcare.health"
        assert user["role"] == "admin"

        r = admin_session.post(f"{BASE}/api/auth/refresh", timeout=15, verify=False)
        assert r.status_code == 200

        # separate session so we don't nuke module-scope fixture
        s = requests.Session()
        s.post(
            f"{BASE}/api/auth/login",
            json={"email": "admin@apexcare.health", "password": "apex123"},
            timeout=15,
            verify=False,
        )
        s.post(f"{BASE}/api/auth/logout", timeout=15, verify=False)
        r = s.get(f"{BASE}/api/auth/me", timeout=15, verify=False)
        assert r.status_code == 401


# ---------------------------------------------------------------- Reporting
class TestReporting:
    def test_live_unauth(self):
        r = requests.get(f"{BASE}/api/reporting/live", timeout=15, verify=False)
        assert r.status_code == 401

    def test_live(self, admin_session):
        r = admin_session.get(f"{BASE}/api/reporting/live", timeout=15, verify=False)
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        m = d["metrics"]
        for k in [
            "apptsToday", "waiting", "completed", "pendingRx", "pendingLabs",
            "unreadMessages", "throughputPct",
        ]:
            assert k in m
            assert isinstance(m[k], int)


# ---------------------------------------------------------------- Patients
class TestPatients:
    def test_list(self, admin_session):
        r = admin_session.get(f"{BASE}/api/patients", timeout=15, verify=False)
        assert r.status_code == 200
        pts = r.json()["patients"]
        assert len(pts) >= 5
        for p in pts:
            assert "_id" not in p
            assert "id" in p
            assert "mrn" in p

    def test_search(self, admin_session):
        r = admin_session.get(f"{BASE}/api/patients/search?q=Adams", timeout=15, verify=False)
        assert r.status_code == 200
        results = r.json()["results"]
        assert any(p["lastName"] == "Adams" for p in results)

    def test_detail(self, admin_session):
        r = admin_session.get(f"{BASE}/api/patients?q=AC-100000", timeout=15, verify=False)
        pid = r.json()["patients"][0]["id"]
        r = admin_session.get(f"{BASE}/api/patients/{pid}", timeout=15, verify=False)
        assert r.status_code == 200
        d = r.json()
        assert d["patient"]["mrn"] == "AC-100000"
        for k in ["allergies", "problems", "medications", "vitals", "appointments", "orders"]:
            assert k in d
            assert isinstance(d[k], list)

    def test_detail_404(self, admin_session):
        r = admin_session.get(f"{BASE}/api/patients/does-not-exist", timeout=15, verify=False)
        assert r.status_code == 404


# ---------------------------------------------------------------- Appointments
class TestSchedule:
    def test_appointments(self, admin_session):
        r = admin_session.get(f"{BASE}/api/appointments", timeout=15, verify=False)
        assert r.status_code == 200
        rows = r.json()["appointments"]
        assert isinstance(rows, list)
        if rows:
            a = rows[0]
            assert "startsAt" in a
            # patient/provider/serviceType may be resolved objects (not required non-null)
            assert "patient" in a and "provider" in a and "serviceType" in a


# ---------------------------------------------------------------- List pages APIs
class TestListEndpoints:
    @pytest.mark.parametrize("path,key", [
        ("/api/encounters", "encounters"),
        ("/api/orders", "orders"),
        ("/api/pharmacies", "pharmacies"),
        ("/api/inventory", "items"),
        ("/api/pos/sales", "sales"),
        ("/api/messages", "messages"),
        ("/api/services", "services"),
    ])
    def test_endpoint(self, admin_session, path, key):
        r = admin_session.get(f"{BASE}{path}", timeout=15, verify=False)
        assert r.status_code == 200, f"{path}: {r.text}"
        assert key in r.json()
        assert isinstance(r.json()[key], list)


# ---------------------------------------------------------------- Admin users
class TestAdminUsers:
    def test_non_admin_forbidden(self, provider_session):
        r = provider_session.get(f"{BASE}/api/admin/users", timeout=15, verify=False)
        assert r.status_code == 403

    def test_list(self, admin_session):
        r = admin_session.get(f"{BASE}/api/admin/users", timeout=15, verify=False)
        assert r.status_code == 200
        users = r.json()["users"]
        assert len(users) >= 8
        assert all("passwordHash" not in u for u in users)

    def test_create_edit_duplicate(self, admin_session):
        email = f"test_{uuid.uuid4().hex[:8]}@apexcare.health"
        r = admin_session.post(
            f"{BASE}/api/admin/users",
            json={
                "email": email, "firstName": "TEST", "lastName": "User",
                "role": "nurse", "temporaryPassword": "apex123",
            },
            timeout=15, verify=False,
        )
        assert r.status_code == 200, r.text
        uid = r.json()["user"]["id"]

        # Edit
        r = admin_session.patch(
            f"{BASE}/api/admin/users",
            json={"id": uid, "specialty": "Cardiology"},
            timeout=15, verify=False,
        )
        assert r.status_code == 200
        assert r.json()["user"]["specialty"] == "Cardiology"

        # Duplicate email conflict
        r = admin_session.patch(
            f"{BASE}/api/admin/users",
            json={"id": uid, "email": "admin@apexcare.health"},
            timeout=15, verify=False,
        )
        assert r.status_code == 409

        # Create duplicate email
        r = admin_session.post(
            f"{BASE}/api/admin/users",
            json={
                "email": email, "firstName": "TEST", "lastName": "User",
                "role": "nurse", "temporaryPassword": "apex123",
            },
            timeout=15, verify=False,
        )
        assert r.status_code == 409

        # Deactivate
        r = admin_session.patch(
            f"{BASE}/api/admin/users",
            json={"id": uid, "active": False},
            timeout=15, verify=False,
        )
        assert r.status_code == 200
        assert r.json()["user"]["active"] is False


# ---------------------------------------------------------------- Migrate
class TestMigrate:
    def test_same_src_dst(self, admin_session):
        users = admin_session.get(f"{BASE}/api/admin/users", timeout=15, verify=False).json()["users"]
        uid = users[0]["id"]
        r = admin_session.post(
            f"{BASE}/api/admin/users/migrate",
            json={"fromUserId": uid, "toUserId": uid, "deactivateSource": False},
            timeout=15, verify=False,
        )
        assert r.status_code == 400

    def test_happy_path(self, admin_session):
        users = admin_session.get(f"{BASE}/api/admin/users", timeout=15, verify=False).json()["users"]
        providers = [u for u in users if u["role"] == "provider" and u.get("active")]
        if len(providers) < 2:
            pytest.skip("need 2 providers")
        r = admin_session.post(
            f"{BASE}/api/admin/users/migrate",
            json={"fromUserId": providers[0]["id"], "toUserId": providers[1]["id"], "deactivateSource": False},
            timeout=30, verify=False,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert "moved" in d and isinstance(d["moved"], int)


# ---------------------------------------------------------------- Portal
class TestPortal:
    def test_login_success(self):
        s = requests.Session()
        r = s.post(
            f"{BASE}/api/portal/auth/login",
            json={"mrn": "AC-100000", "dob": "1958-04-12"},
            timeout=15, verify=False,
        )
        assert r.status_code == 200
        assert "apexcare_portal_session" in s.cookies.get_dict()

        r = s.get(f"{BASE}/api/portal/me", timeout=15, verify=False)
        assert r.status_code == 200
        d = r.json()
        assert d["patient"]["mrn"] == "AC-100000"
        assert "appointments" in d and "documents" in d and "messages" in d

    def test_login_bad_dob(self):
        r = requests.post(
            f"{BASE}/api/portal/auth/login",
            json={"mrn": "AC-100000", "dob": "1999-01-01"},
            timeout=15, verify=False,
        )
        assert r.status_code == 401

    def test_portal_me_unauth(self):
        r = requests.get(f"{BASE}/api/portal/me", timeout=15, verify=False)
        assert r.status_code == 401
