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

# Costing constants (see context.md section 10)
YARN_KG_PER_METRE = 0.59      # 2000 m of fabric needs 1180 kg of yarn
OVERTIME_MULTIPLIER = 1.5     # overtime hours are paid at 1.5x the hourly rate
TARGET_MARGIN = 25.0          # factory target margin %, used for warnings and belowTarget
EXPECTED_MARGIN = 28.0        # benchmark margin % used by profit leakage

# Machine simulator runs inside the API process; set SIMULATOR_AUTOSTART=false to start it paused
SIMULATOR_AUTOSTART = os.getenv("SIMULATOR_AUTOSTART", "true").lower() in ("1", "true", "yes")

# Rework cost impact of a failed / reworked roll (INR per affected metre)
REWORK_LABOUR_PER_METRE = 9.2
REWORK_MACHINE_PER_METRE = 5.7
# Share of the affected fabric's yarn that is lost. 1.0 = all of it (0.59 kg/m x costPerKg).
REWORK_MATERIAL_LOSS_SHARE = 1.0

# Public base URL of the frontend; the passport QR code points to {PASSPORT_BASE_URL}/passport/{rollId}
PASSPORT_BASE_URL = os.getenv("PASSPORT_BASE_URL", "http://localhost:5173").rstrip("/")

# Public base URL used in buyer tracking links: {TRACKING_BASE_URL}/track/{trackingToken}.
# Defaults to PASSPORT_BASE_URL (the public frontend) when unset.
TRACKING_BASE_URL = (os.getenv("TRACKING_BASE_URL") or PASSPORT_BASE_URL).rstrip("/")

# Protects POST /api/demo/reset (header X-Admin-Key). Unset = the reset endpoint is disabled.
ADMIN_KEY = os.getenv("ADMIN_KEY")
