"""App settings, read from environment variables (see backend/.env.example)."""
import os

from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
if not MONGODB_URI:
    raise RuntimeError(
        "MONGODB_URI is not set. Copy backend/.env.example to backend/.env "
        "and fill in your MongoDB connection string."
    )

DB_NAME = os.getenv("DB_NAME") or os.getenv("MONGODB_DB_NAME") or "loomsense"
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]
