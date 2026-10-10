"""One-shot seed job for Docker: load demo data only when the database is empty.

    python docker_seed.py          (FORCE_SEED=true reloads even if data exists)

Waits for MongoDB, then exits 0, so restarting the stack never wipes data entered by hand.
"""
import os
import sys
import time

from app import database as dbm
from app import seed


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
    if existing and not force:
        print(f"Database already has {existing} orders: skipping seed (set FORCE_SEED=true to reload).", flush=True)
        return
    print("Loading demo data ..." if not existing else "FORCE_SEED=true: reloading demo data ...", flush=True)
    seed.main()


if __name__ == "__main__":
    main()
