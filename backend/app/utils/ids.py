"""Small helpers for generating readable IDs like ORD10492 or RL10092."""
import random


def generate_id(prefix: str, digits: int = 5) -> str:
    return f"{prefix}{random.randint(10 ** (digits - 1), 10 ** digits - 1)}"
