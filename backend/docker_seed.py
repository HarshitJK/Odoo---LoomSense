"""One-shot seed job: empty database, explicit force, or opted-in seed-version upgrade.

    python docker_seed.py          (FORCE_SEED=true reloads even if data exists)

Version upgrades are opt-in outside the demo compose configuration.
"""
import os
import sys
import time

from app import database as dbm
from app import seed, migrate


def main():
    for _ in range(60):
        if dbm.ping():
            break
        print("Waiting for MongoDB ...", flush=True)
        time.sleep(2)
    else:
        sys.exit("MongoDB did not become reachable")

    force = os.getenv("FORCE_SEED", "false").lower() in ("1", "true", "yes")
    existing = dbm.orders().count_documents({})
    stored = (dbm.db.meta.find_one({"_id": "seed"}) or {}).get("seedVersion")
    auto = os.getenv("AUTO_RESEED_ON_VERSION_CHANGE", "false").lower() in ("1", "true", "yes")
    upgrade = auto and stored != seed.SEED_VERSION
    if existing and not force and not upgrade:
        print(f"Database already has {existing} orders: skipping seed (set FORCE_SEED=true to reload).", flush=True)
        migrate.main()
        return
    reason = "empty database" if not existing else "FORCE_SEED=true" if force else f"seed version {stored} -> {seed.SEED_VERSION}"
    print(f"Loading demo data ({reason}) ...", flush=True)
    seed.main()


if __name__ == "__main__":
    main()
