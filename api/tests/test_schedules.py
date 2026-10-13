"""Tests for automated campaign schedules and background scheduler."""

import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.schedules.service import compute_next_run, get_schedule_service
from app.schedules.store import Schedule, ScheduleStore
from app.webapp import app


@pytest.fixture
def temp_store():
    with tempfile.NamedTemporaryFile(suffix=".db") as f:
        store = ScheduleStore(db_path=Path(f.name))
        yield store


def test_schedule_store_crud(temp_store):
    schedule = Schedule(
        id=str(uuid.uuid4()),
        owner_account_id="acc_1",
        title="Weekly Promo",
        brief="Promote our special coffee roast",
        language="en",
        time_of_day="10:00",
        days_of_week=["mon", "wed"],
        auto_post_facebook=True,
    )
    temp_store.create(schedule)

    fetched = temp_store.get(schedule.id)
    assert fetched is not None
    assert fetched.title == "Weekly Promo"
    assert fetched.days_of_week == ["mon", "wed"]
    assert fetched.auto_post_facebook is True
    assert fetched.is_active is True

    # List for account
    listed = temp_store.list_for_account("acc_1")
    assert len(listed) == 1
    assert listed[0].id == schedule.id

    # Update
    updated = temp_store.update(schedule.id, title="Updated Promo", time_of_day="14:00")
    assert updated.title == "Updated Promo"
    assert updated.time_of_day == "14:00"

    # Toggle active
    toggled = temp_store.toggle_active(schedule.id)
    assert toggled.is_active is False

    # Delete
    deleted = temp_store.delete(schedule.id)
    assert deleted is True
    assert temp_store.get(schedule.id) is None


def test_compute_next_run_recurring():
    schedule = Schedule(
        id="s1",
        owner_account_id="acc_1",
        title="Daily Morning",
        brief="Daily coffee update",
        schedule_type="recurring",
        time_of_day="09:00",
        days_of_week=["mon", "tue", "wed", "thu", "fri"],
        timezone="Asia/Phnom_Penh",
        is_active=True,
    )
    next_iso = compute_next_run(schedule)
    assert next_iso is not None
    dt = datetime.fromisoformat(next_iso)
    assert dt > datetime.now(timezone.utc)


@pytest.mark.asyncio
async def test_schedules_api_endpoints():
    from app.dependencies import require_user
    user = {"id": "test_user_sched", "email": "sched@example.com"}
    app.dependency_overrides[require_user] = lambda: user
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Create schedule
            res = await client.post(
                "/api/schedules",
                json={
                    "title": "Automated Friday Deal",
                    "brief": "Promote our special Friday offer for 20% discount on cakes.",
                    "language": "en",
                    "time_of_day": "09:30",
                    "days_of_week": ["fri"],
                    "auto_post_facebook": True,
                },
            )
            assert res.status_code == 200, res.text
            data = res.json()
            assert data["ok"] is True
            sched_id = data["schedule"]["id"]
            assert data["schedule"]["title"] == "Automated Friday Deal"

            # 2. List schedules
            res = await client.get("/api/schedules")
            assert res.status_code == 200
            list_data = res.json()
            assert list_data["total"] >= 1
            assert any(s["id"] == sched_id for s in list_data["schedules"])

            # 3. Toggle schedule
            res = await client.post(f"/api/schedules/{sched_id}/toggle")
            assert res.status_code == 200
            assert res.json()["schedule"]["is_active"] is False

            # 4. Delete schedule
            res = await client.delete(f"/api/schedules/{sched_id}")
            assert res.status_code == 200
            assert res.json()["ok"] is True
    finally:
        app.dependency_overrides.pop(require_user, None)
