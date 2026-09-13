from __future__ import annotations

from functools import lru_cache

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import get_settings


@lru_cache
def get_s3_client():
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key.get_secret_value(),
        config=Config(
            s3={"addressing_style": "path"},
            signature_version="s3v4",
            connect_timeout=5,
            read_timeout=30,
            retries={"max_attempts": 2, "mode": "standard"},
        ),
    )


def verify_storage_buckets() -> None:
    client = get_s3_client()
    settings = get_settings()
    client.head_bucket(Bucket=settings.s3_private_bucket)
    client.head_bucket(Bucket=settings.s3_public_bucket)


def initialize_local_storage() -> list[str]:
    """Create only missing development buckets; never change existing data or policies."""
    settings = get_settings()
    if settings.environment != "development":
        raise ValueError("Storage initialization is limited to the development environment.")
    client = get_s3_client()
    created = []
    for bucket in dict.fromkeys((settings.s3_private_bucket, settings.s3_public_bucket)):
        try:
            client.head_bucket(Bucket=bucket)
        except ClientError as error:
            if error.response["Error"]["Code"] not in ("404", "NoSuchBucket", "NotFound"):
                raise
            options = {"Bucket": bucket}
            if settings.s3_region != "us-east-1":
                options["CreateBucketConfiguration"] = {"LocationConstraint": settings.s3_region}
            try:
                client.create_bucket(**options)
            except ClientError as create_error:
                if create_error.response["Error"]["Code"] != "BucketAlreadyOwnedByYou":
                    raise
            else:
                created.append(bucket)
            client.head_bucket(Bucket=bucket)
    return created


@lru_cache
def get_s3_signing_client():
    settings = get_settings()
    if not settings.s3_browser_endpoint_url:
        return get_s3_client()
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_browser_endpoint_url,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key.get_secret_value(),
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )
