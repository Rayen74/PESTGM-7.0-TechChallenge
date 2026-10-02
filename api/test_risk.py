import io
import json

import pytest

from api import risk


@pytest.mark.parametrize("status", [None, "SUBMITTED", "UNDER_REVIEW", "INFO_REQUESTED", "APPROVED",
                                     "INSTALLATION_SCHEDULED", "INSTALLING", "COMMISSIONING", "REJECTED"])
def test_only_active_battery_enables_risk(status):
    assert risk.is_active_battery_status(status) is False


def test_active_battery_enables_risk():
    assert risk.is_active_battery_status("ACTIVE") is True


@pytest.mark.parametrize(("certitude", "expected_level"), [(90, "LOW"), (70, "MEDIUM"), (40, "HIGH")])
def test_risk_levels(certitude, expected_level, monkeypatch):
    monkeypatch.setattr(risk, "_weather", lambda *_: {"available": False, "factors": []})
    assert risk.assess_risk(100, 90, 110, certitude)["risk_level"] == expected_level


def test_openweather_success(monkeypatch):
    payload = {"list": [{"clouds": {"all": 80}, "rain": {"3h": 2}, "wind": {"speed": 12}}]}
    class Response(io.BytesIO):
        def __enter__(self): return self
        def __exit__(self, *args): return False
    monkeypatch.setenv("OPEN_WEATHER_API_KEY", "test-key")
    monkeypatch.setattr(risk, "urlopen", lambda *args, **kwargs: Response(json.dumps(payload).encode()))
    risk._weather_cache.clear()
    result = risk._weather(36.8, 10.1)
    assert result["available"] is True
    assert result["rain_mm"] == 2.0


def test_openweather_failure_and_missing_key(monkeypatch):
    monkeypatch.delenv("OPEN_WEATHER_API_KEY", raising=False)
    assert risk._weather(36.8, 10.1)["available"] is False
    monkeypatch.setenv("OPEN_WEATHER_API_KEY", "test-key")
    monkeypatch.setattr(risk, "urlopen", lambda *args, **kwargs: (_ for _ in ()).throw(OSError("offline")))
    risk._weather_cache.clear()
    assert risk._weather(36.9, 10.2)["available"] is False


def test_invalid_forecast_is_rejected_by_assessment():
    with pytest.raises((TypeError, ValueError)):
        risk.assess_risk(float("nan"), 1, 2, 90)
