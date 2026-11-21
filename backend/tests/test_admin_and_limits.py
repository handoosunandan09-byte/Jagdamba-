"""Tests for the admin console API, activity tracking and rate limits.

Run from the backend folder:
    pip install -r requirements.txt -r requirements-dev.txt
    python -m pytest -q tests
Uses an in-memory MongoDB stand-in, and replaces Google's token check with a fake,
so no internet connection or real database is needed.
"""
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from mongomock_motor import AsyncMongoMockClient  # noqa: E402

ADMIN = "owner@example.com"
TOKENS = {
    "good": {"email": ADMIN, "email_verified": True, "name": "Owner"},
    "stranger": {"email": "someone@example.com", "email_verified": True},
    "unverified": {"email": ADMIN, "email_verified": False},
}


def fake_verify(token, _request, audience):
    assert audience == "test-client-id"
    if token not in TOKENS:
        raise ValueError("bad token")
    return TOKENS[token]


@pytest.fixture()
def api(monkeypatch):
    mongo = AsyncMongoMockClient()
    monkeypatch.setattr(server, "db", mongo["test"])
    monkeypatch.setattr(server, "DB_ERROR", None)
    monkeypatch.setattr(server, "ADMIN_GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setattr(server, "ADMIN_EMAILS", {ADMIN})
    monkeypatch.setattr(server.g_id_token, "verify_oauth2_token", fake_verify)
    monkeypatch.setattr(server, "_limiter", server.RateLimiter())
    monkeypatch.setattr(server, "_seen_at", {})
    return TestClient(server.app)  # no "with": skips the startup hook that pings a real database


def auth(t):
    return {"Authorization": f"Bearer {t}"}


def test_config_reports_setup(api, monkeypatch):
    assert api.get("/api/admin/config").json() == {"configured": True, "google_client_id": "test-client-id"}
    monkeypatch.setattr(server, "ADMIN_EMAILS", set())
    assert api.get("/api/admin/config").json()["configured"] is False
    assert api.get("/api/admin/me", headers=auth("good")).status_code == 503


@pytest.mark.parametrize("headers,code", [
    ({}, 401),
    (auth("forged"), 401),
    (auth("stranger"), 403),
    (auth("unverified"), 403),
    (auth("good"), 200),
])
def test_only_allowlisted_admin_gets_in(api, headers, code):
    for path in ("/api/admin/me", "/api/admin/users-summary", "/api/admin/payments-summary"):
        assert api.get(path, headers=headers).status_code == code, path


def test_users_summary_counts(api):
    now = datetime.now(timezone.utc)
    rows = [
        {"device_id": "a", "name": "A", "created_at": now - timedelta(hours=2), "last_seen": now - timedelta(hours=1)},
        {"device_id": "b", "name": "B", "created_at": now - timedelta(days=3), "last_seen": now - timedelta(days=3)},
        {"device_id": "c", "name": "C", "created_at": now - timedelta(days=20), "last_seen": now - timedelta(days=20)},
        {"device_id": "old", "name": "Old"},  # registered before tracking existed
    ]
    import anyio
    anyio.run(lambda: server.db.profiles.insert_many(rows))
    anyio.run(lambda: server.db.contacts.insert_many([{"device_id": "a", "id": "1"}, {"device_id": "a", "id": "2"}]))

    data = api.get("/api/admin/users-summary", headers=auth("good")).json()
    assert data["registered"] == 4
    assert data["active"] == {"day": 1, "week": 2, "month": 3}
    assert data["new"] == {"week": 2, "month": 3}
    assert data["registered_before_tracking"] == 1
    assert data["with_trusted_contacts"] == 1
    assert len(data["signups_daily"]) == 30
    assert sum(d["value"] for d in data["signups_daily"]) == 3
    # Counts only: no personal details leave the server
    assert "A" not in str(data) and "name" not in str(data)


def test_payments_summary_empty_then_filled(api):
    import anyio
    data = api.get("/api/admin/payments-summary", headers=auth("good")).json()
    assert data["billing_live"] is False
    assert data["all_time"]["net_inr"] == 0

    now = datetime.now(timezone.utc)
    anyio.run(lambda: server.db.subscriptions.insert_many([
        {"status": "active", "expiry_time": now + timedelta(days=20)},
        {"status": "grace_period", "expiry_time": now + timedelta(days=2)},
        {"status": "cancelled", "expiry_time": now + timedelta(days=5)},
        {"status": "expired", "expiry_time": now - timedelta(days=5)},
    ]))
    anyio.run(lambda: server.db.payments.insert_many([
        {"kind": "new", "amount_paise": 9900, "at": now - timedelta(days=40)},
        {"kind": "new", "amount_paise": 9900, "at": now - timedelta(days=2)},
        {"kind": "renewal", "amount_paise": 9900, "at": now - timedelta(days=1)},
        {"kind": "refund", "amount_paise": 9900, "at": now - timedelta(hours=5)},
    ]))
    data = api.get("/api/admin/payments-summary", headers=auth("good")).json()
    assert data["billing_live"] is True
    assert data["subscriptions"]["active"] == 2
    assert data["subscriptions"]["cancelling"] == 1
    assert data["subscriptions"]["expired"] == 1
    assert data["all_time"] == {"new_payments": 2, "renewals": 1, "refunds": 1,
                                "gross_inr": 297.0, "refunded_inr": 99.0, "net_inr": 198.0}
    assert data["last_30_days"]["net_inr"] == 99.0
    assert sum(d["value"] for d in data["payments_daily"]) == 2


def test_profile_tracking_fields_stay_private(api):
    import anyio
    h = {"X-Device-Id": "dev-1"}
    assert api.put("/api/profile", json={"name": "Asha Rao"}, headers=h).status_code == 200
    doc = anyio.run(lambda: server.db.profiles.find_one({"device_id": "dev-1"}))
    assert doc["created_at"] and doc["last_seen"]
    body = api.get("/api/profile", headers=h).json()
    assert "last_seen" not in body and "created_at" not in body and body["name"] == "Asha Rao"


def test_sos_rate_limit_and_contact_cap(api):
    h = {"X-Device-Id": "dev-2"}
    codes = [api.post("/api/sos", json={"reason": "sos"}, headers=h).status_code for _ in range(7)]
    assert codes == [200] * 6 + [429]
    for i in range(server.MAX_CONTACTS):
        assert api.post("/api/contacts", json={"name": f"C{i}", "phone": f"98765432{i:02d}"}, headers=h).status_code == 200
    r = api.post("/api/contacts", json={"name": "Extra", "phone": "9876500000"}, headers=h)
    assert r.status_code == 400 and "up to" in r.json()["detail"]


def test_chat_sessions_stay_bounded():
    server._chat_sessions.clear()
    for i in range(server.MAX_CHAT_SESSIONS + 50):
        server.get_chat(f"s{i}", "prompt")
    assert len(server._chat_sessions) == server.MAX_CHAT_SESSIONS
    assert "s0" not in server._chat_sessions


def test_health(api, monkeypatch):
    class FakeAdmin:
        async def command(self, _):
            return {"ok": 1}

    class FakeClient:
        admin = FakeAdmin()

    monkeypatch.setattr(server, "client", FakeClient())
    monkeypatch.setattr(server, "_health", {"at": 0.0, "ok": False})
    assert api.get("/api/health").json() == {"ok": True}


def test_region_recorded_from_area_lookup_and_counted(api, monkeypatch):
    import anyio

    async def fake_reverse(lat, lng):
        return {"state": "Karnataka", "city": "Bengaluru", "label": "Whitefield, Bengaluru"}

    monkeypatch.setattr(server, "reverse_geocode", fake_reverse)
    monkeypatch.setattr(server, "_region_at", {})
    h = {"X-Device-Id": "dev-r1"}
    api.put("/api/profile", json={"name": "Asha"}, headers=h)
    assert api.get("/api/geo/reverse?lat=12.97&lng=77.75", headers=h).status_code == 200
    doc = anyio.run(lambda: server.db.profiles.find_one({"device_id": "dev-r1"}))
    assert doc["region"] == {"state": "Karnataka", "city": "Bengaluru"}
    assert "lat" not in str(doc["region"])  # coordinates are never stored
    # Region is internal: not returned to the phone
    assert "region" not in api.get("/api/profile", headers=h).json()
    # A phone without a profile is not tracked
    api.get("/api/geo/reverse?lat=1&lng=1", headers={"X-Device-Id": "no-profile"})
    assert anyio.run(lambda: server.db.profiles.find_one({"device_id": "no-profile"})) is None

    now = datetime.now(timezone.utc)
    anyio.run(lambda: server.db.profiles.insert_many([
        {"device_id": "m1", "region": {"state": "Maharashtra", "city": "Mumbai"}, "last_seen": now},
        {"device_id": "m2", "region": {"state": "Maharashtra", "city": "Pune"}, "last_seen": now - timedelta(days=60)},
        {"device_id": "m3", "region": {"state": "Maharashtra", "city": "Mumbai"}, "last_seen": now},
        {"device_id": "x1"},
    ]))
    r = api.get("/api/admin/users-summary", headers=auth("good")).json()["regions"]
    assert r["by_state"][0] == {"state": "Maharashtra", "users": 3, "active_30d": 2}
    assert {"state": "Karnataka", "users": 1, "active_30d": 1} in r["by_state"]
    assert r["by_city"][0] == {"city": "Mumbai", "state": "Maharashtra", "users": 2, "active_30d": 2}
    assert r["unknown"] == 1
