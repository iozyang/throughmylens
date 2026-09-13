import json
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import SecretStr

from app.photos import translation
from app.photos.naming import filename_for


def test_capture_clock_and_unbounded_number():
    uploaded = datetime(2026, 9, 13, 2, 3, 4, tzinfo=UTC)
    assert filename_for({"date": "2025-12-03", "time": "13:05:16"}, uploaded, 127) == "20251203-130516-000127.jpg"
    assert filename_for({"date": "2025-12-03", "time": ""}, uploaded, 1000000) == "20251203-000000-1000000.jpg"
    assert filename_for({}, uploaded, 9) == "20260913-100304-000009.jpg"
    assert filename_for({"date": "2025-02-30"}, uploaded, 9) == "20260913-100304-000009.jpg"


def test_translation_rejects_unrequested_or_incomplete_fields():
    expected = {"title": "冬日"}
    assert translation.validate_suggestions('{"title":"Winter"}', expected) == {"title": "Winter"}
    for raw in ('{}', '{"title":null}', '{"title":"Winter","iso":"100"}', '{"title":""}', '[]'):
        with pytest.raises(ValueError):
            translation.validate_suggestions(raw, expected)
    with pytest.raises(ValueError):
        translation.TranslationRequest(fields={"geo.latitude": {"zh": "31", "en": ""}})


def test_provider_contract_preserves_english_and_sends_no_exif(monkeypatch):
    settings = SimpleNamespace(translation_api_key=SecretStr("test-secret"), translation_model="chosen-model", translation_timeout_seconds=40)
    monkeypatch.setattr(translation, "get_settings", lambda: settings)
    received = []

    class Reply:
        status = 200
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def read(self, limit):
            return json.dumps({"choices": [{"finish_reason": "stop", "message": {"content": '{"title":"Winter"}'}}]}).encode()

    def open_request(req, timeout):
        received.append(json.loads(req.data))
        assert req.full_url == translation.ENDPOINT
        return Reply()

    monkeypatch.setattr(translation, "build_opener", lambda *args: SimpleNamespace(open=open_request))
    result = translation.translate(translation.TranslationRequest(fields={
        "title": {"zh": "冬日", "en": ""}, "alt": {"zh": "雪", "en": "User translation"}}))
    assert result == {"title": "Winter"}
    assert json.loads(received[0]["messages"][1]["content"]) == {"title": "冬日"}
    assert received[0]["model"] == "chosen-model"
    assert received[0]["reasoning_effort"] == "none"


def test_unconfigured_translation_is_safe(monkeypatch):
    monkeypatch.setattr(translation, "get_settings", lambda: SimpleNamespace(translation_api_key=SecretStr("")))
    with pytest.raises(HTTPException) as error:
        translation.translate(translation.TranslationRequest(fields={"title": {"zh": "雪", "en": ""}}))
    assert error.value.status_code == 503
