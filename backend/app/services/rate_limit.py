"""Tiny in-memory sliding-window rate limit (one API instance, so no shared store is needed)."""
import time
from collections import defaultdict, deque

_hits = defaultdict(deque)


def allow(key: str, limit: int, window: float = 60.0) -> bool:
    now = time.monotonic()
    if len(_hits) > 10000:  # drop idle clients so the table cannot grow without bound
        for k in [k for k, d in _hits.items() if not d or now - d[-1] > window]:
            del _hits[k]
    hits = _hits[key]
    while hits and now - hits[0] > window:
        hits.popleft()
    if len(hits) >= limit:
        return False
    hits.append(now)
    return True


def reset():
    _hits.clear()
