"""MongoDB connection. The API still starts if MongoDB is down."""
from fastapi import HTTPException
from pymongo import MongoClient

from app.config import MONGODB_DB_NAME, MONGODB_URI

# MongoClient connects lazily, so creating it never crashes startup.
client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2000)


def get_db():
    """Return the database, or raise HTTP 503 if MongoDB is unreachable.

    Use in routes:  db = get_db();  db["orders"].find(...)
    """
    try:
        client.admin.command("ping")
    except Exception:
        raise HTTPException(status_code=503, detail="MongoDB is not available")
    return client[MONGODB_DB_NAME]


def mongo_is_up() -> bool:
    try:
        client.admin.command("ping")
        return True
    except Exception:
        return False
