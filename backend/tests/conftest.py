import os

# Use a separate database so tests never touch the dev data. Must be set before app imports.
os.environ["DB_NAME"] = "loomsense_test"

import pytest  # noqa: E402

from app import seed  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def seeded_db():
    seed.main()
    yield
