from __future__ import annotations

import argparse
import getpass
import sys

from email_validator import EmailNotValidError, validate_email
from pwdlib import PasswordHash
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.user import User

password_hasher = PasswordHash.recommended()


def create_admin(email_input: str) -> int:
    try:
        email = validate_email(email_input, check_deliverability=False).normalized.lower()
    except EmailNotValidError as error:
        print(f"Invalid email: {error}", file=sys.stderr)
        return 2

    password = getpass.getpass("Password (minimum 12 characters): ")
    confirm_password = getpass.getpass("Confirm password: ")
    if len(password) < 12:
        print("Password must contain at least 12 characters.", file=sys.stderr)
        return 2
    if password != confirm_password:
        print("Passwords do not match.", file=sys.stderr)
        return 2

    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == email)):
            print("An account with this email already exists.", file=sys.stderr)
            return 2
        db.add(User(email=email, password_hash=password_hasher.hash(password)))
        db.commit()

    print(f"Administrator created for {email}.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="throughmylens maintenance commands")
    subcommands = parser.add_subparsers(dest="command", required=True)
    create_admin_parser = subcommands.add_parser("create-admin")
    create_admin_parser.add_argument("--email", required=True)
    subcommands.add_parser("init-storage", help="Ensure local development buckets exist")
    names = subcommands.add_parser(
        "migrate-photo-names", help="Preview friendly names; --apply commits atomically"
    )
    names.add_argument("--apply", action="store_true")
    subcommands.add_parser(
        "backfill-previews", help="Add missing 160/960px private previews; preserve existing images"
    )
    arguments = parser.parse_args()
    if arguments.command == "backfill-previews":
        from app.photos.backfill_previews import backfill

        with SessionLocal() as db:
            print(f"Added {backfill(db)} preview assets.")
        return 0
    if arguments.command == "migrate-photo-names":
        import json

        from app.photos.naming import migrate_names

        with SessionLocal() as db:
            print(json.dumps(migrate_names(db, arguments.apply), ensure_ascii=False, indent=2))
        return 0

    if arguments.command == "create-admin":
        return create_admin(arguments.email)
    if arguments.command == "init-storage":
        from botocore.exceptions import BotoCoreError, ClientError

        from app.storage.s3 import initialize_local_storage

        try:
            created = initialize_local_storage()
        except (BotoCoreError, ClientError, ValueError) as error:
            print(
                f"Storage initialization failed ({type(error).__name__}). "
                "Check MinIO and the S3 settings in .env.",
                file=sys.stderr,
            )
            return 1
        print(
            "Created private buckets: " + ", ".join(created)
            if created
            else "Storage buckets ready."
        )
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
