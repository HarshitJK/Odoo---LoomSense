from datetime import date
from typing import Optional

from fastapi import HTTPException


def valid_month(month: Optional[str]) -> str:
    """Return a YYYY-MM string (default: the current month) or raise HTTP 422."""
    month = month or date.today().strftime("%Y-%m")
    try:
        if len(month) != 7 or month[4] != "-":
            raise ValueError
        date.fromisoformat(month + "-01")
    except ValueError:
        raise HTTPException(422, "month must look like 2026-10")
    return month
