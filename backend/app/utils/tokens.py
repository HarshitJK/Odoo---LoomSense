"""Random, unguessable tracking tokens for the private buyer link."""
import re
import secrets

TRACKING_PATH = re.compile(r"(/api/buyer/track/)([^/?#\s]{1,4})[^/?#\s]*")


def new_tracking_token() -> str:
    return secrets.token_urlsafe(16)  # 128 bits, 22 URL-safe characters


def mask_tracking_path(text: str) -> str:
    """Hide all but the first 4 characters of a token in a path, for logs."""
    return TRACKING_PATH.sub(r"\1\2...", text)
