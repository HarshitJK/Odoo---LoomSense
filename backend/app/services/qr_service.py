"""QR code generation for the Fabric Digital Passport."""
import base64
import io

import qrcode


def generate_roll_qr(roll_id: str, base_url: str = "http://localhost:5173") -> str:
    """Return a base64 PNG data URI of a QR pointing to /passport/{roll_id}."""
    img = qrcode.make(f"{base_url}/passport/{roll_id}")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
