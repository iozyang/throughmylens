import boto3
import pytest
from botocore.exceptions import ClientError
from botocore.stub import Stubber

from app.storage import s3


@pytest.fixture
def storage(monkeypatch):
    client = boto3.client(
        "s3",
        endpoint_url="http://localhost:9000",
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )
    monkeypatch.setattr(s3, "get_s3_client", lambda: client)
    settings = s3.get_settings()
    monkeypatch.setattr(settings, "environment", "development")
    monkeypatch.setattr(settings, "s3_region", "us-east-1")
    monkeypatch.setattr(settings, "s3_private_bucket", "tml-private")
    monkeypatch.setattr(settings, "s3_public_bucket", "tml-public")
    with Stubber(client) as stub:
        yield stub
        stub.assert_no_pending_responses()


def test_create_missing_buckets_without_public_policies(storage):
    for bucket in ("tml-private", "tml-public"):
        storage.add_client_error(
            "head_bucket",
            service_error_code="404",
            http_status_code=404,
            expected_params={"Bucket": bucket},
        )
        storage.add_response("create_bucket", {}, {"Bucket": bucket})
        storage.add_response("head_bucket", {}, {"Bucket": bucket})
    assert s3.initialize_local_storage() == ["tml-private", "tml-public"]


def test_existing_buckets_are_not_modified(storage):
    for bucket in ("tml-private", "tml-public"):
        storage.add_response("head_bucket", {}, {"Bucket": bucket})
    assert s3.initialize_local_storage() == []


def test_permission_denied_does_not_attempt_creation(storage):
    storage.add_client_error(
        "head_bucket",
        service_error_code="403",
        http_status_code=403,
        expected_params={"Bucket": "tml-private"},
    )
    with pytest.raises(ClientError):
        s3.initialize_local_storage()


def test_initialization_is_development_only(storage, monkeypatch):
    monkeypatch.setattr(s3.get_settings(), "environment", "production")
    with pytest.raises(ValueError, match="development"):
        s3.initialize_local_storage()
