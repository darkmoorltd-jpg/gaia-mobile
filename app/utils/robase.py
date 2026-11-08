import os
import re
import requests
from typing import Dict, Any

# Configurable — overridable via env if Robase changes their API
ROBASE_BASE_URL = os.getenv("ROBASE_BASE_URL", "https://api.robase.dev/v1")
ROBASE_API_KEY = os.getenv("ROBASE_API_KEY", "")
ROBASE_ENDPOINT = os.getenv("ROBASE_ENDPOINT", "messages")  # or "sms/send"


class RobaseError(Exception):
    pass


def _headers() -> Dict[str, str]:
    if not ROBASE_API_KEY:
        raise RobaseError("ROBASE_API_KEY not configured")
    return {
        "Authorization": f"Bearer {ROBASE_API_KEY}",
        "Content-Type": "application/json",
    }


def normalize_e164(phone: str) -> str:
    """Normalize a Nigerian phone to +234... format for Robase."""
    if not phone:
        return ""
    p = re.sub(r"[^\d]", "", phone)
    if p.startswith("0"):
        p = "234" + p[1:]
    elif not p.startswith("234") and len(p) == 10:
        p = "234" + p
    return "+" + p if p else ""


def send_sms(phone: str, message: str) -> Dict[str, Any]:
    """
    Send an SMS via Robase.
    Returns dict with 'ok' key. Logs everything with [robase] prefix
    so failures are visible in Render logs.
    """
    phone_e164 = normalize_e164(phone)
    if not phone_e164 or len(phone_e164) < 10:
        return {"ok": False, "error": f"invalid phone: {phone!r}"}

    if not ROBASE_API_KEY:
        return {"ok": False, "error": "ROBASE_API_KEY not configured on Render"}

    url = f"{ROBASE_BASE_URL}/{ROBASE_ENDPOINT}"
    # Build payload — try messages shape first; if the env says sms/send, use that shape
    if ROBASE_ENDPOINT == "sms/send":
        payload = {"phone_number": phone_e164, "message": message}
    else:
        payload = {"to": phone_e164, "message": message, "channel": "sms"}

    try:
        r = requests.post(url, headers=_headers(), json=payload, timeout=15)
    except requests.RequestException as e:
        print(f"[robase] NETWORK ERROR url={url} err={e}")
        return {"ok": False, "error": f"network: {e}"}

    body = r.text[:400] if r.text else ""
    print(f"[robase] {r.status_code} url={url} phone={phone_e164} body={body}")

    if r.status_code in (200, 201, 202):
        try:
            data = r.json()
            # Message IDs vary by endpoint; grab whatever looks right
            mid = (
                data.get("message_id")
                or data.get("id")
                or (data.get("data") or {}).get("id")
                or (data.get("data") or {}).get("message_id")
            )
            return {"ok": True, "message_id": mid, "raw": data}
        except Exception:
            return {"ok": True, "raw": body}

    return {"ok": False, "status": r.status_code, "error": body}
