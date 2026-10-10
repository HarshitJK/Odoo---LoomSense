import os
import secrets
os.environ["DB_NAME"] = "loomsense_test"
os.environ["MONGODB_URI"] = "mongodb://localhost:27017"
os.environ["JWT_SECRET"] = secrets.token_urlsafe(48)
for role in ("OWNER", "PRODUCTION_MANAGER", "WORKER_QC"):
    os.environ["SEED_" + role + "_PASSWORD"] = secrets.token_urlsafe(20)
os.environ["SIMULATOR_AUTOSTART"] = "false"
import pytest
import mongomock
from app import database as dbm
# Isolated, deterministic tests never connect to or erase a developer database.
dbm.db = mongomock.MongoClient()["loomsense_test"]
dbm.ping = lambda: True
from app import seed
from app.services.auth import issue_token

@pytest.fixture(scope="session", autouse=True)
def seeded_db():
    seed.main()
    yield

@pytest.fixture(autouse=True)
def authenticated_legacy_client(request, seeded_db):
    client = getattr(request.module, "client", None)
    if client is not None:
        client.headers["Authorization"] = "Bearer " + issue_token({"email": "owner@loomsense.demo"})
