"""QR code generation for the Fabric Digital Passport."""
import io

import qrcode

from app.config import PASSPORT_BASE_URL


def passport_url(roll_id: str) -> str:
    return f"{PASSPORT_BASE_URL}/passport/{roll_id}"


def generate_roll_qr(roll_id: str) -> bytes:
    """PNG image bytes of a QR code that opens the roll's passport page."""
    buf = io.BytesIO()
    qrcode.make(passport_url(roll_id)).save(buf, format="PNG")
    return buf.getvalue()
