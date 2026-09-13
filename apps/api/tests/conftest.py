import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://unused:unused@localhost:5432/unused")
os.environ.setdefault(
    "AUTH_SECRET_KEY", "test-secret-that-is-long-enough-to-exercise-local-settings-only"
)
os.environ.setdefault("S3_ACCESS_KEY", "test-access")
os.environ.setdefault("S3_SECRET_KEY", "test-secret")
os.environ.setdefault("S3_PUBLIC_BASE_URL", "http://localhost:9000/tml-public")
