"""One shared MongoClient plus helpers to get each collection.

MongoClient connects lazily, so importing this never crashes if MongoDB is down.
"""
from fastapi import HTTPException
from pymongo import MongoClient

from app.config import DB_NAME, MONGODB_URI

client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
db = client[DB_NAME]


def ping() -> bool:
    try:
        client.admin.command("ping")
        return True
    except Exception:
        return False


def get_db():
    """Return the database, or raise HTTP 503 if MongoDB is unreachable."""
    if not ping():
        raise HTTPException(status_code=503, detail="MongoDB is not available")
    return db


def orders():
    return db["orders"]


def machines():
    return db["machines"]


def inventory():
    return db["inventory"]


def workers():
    return db["workers"]


def attendance():
    return db["attendance"]


def quality_checks():
    return db["qualityChecks"]


def transactions():
    return db["transactions"]
