"""Shared helpers for the OskiHub event-parking pipeline.

Design rules:
- Deterministic: same inputs -> byte-identical outputs.
- Atomic writes: write to temp file, fsync, os.replace. Readers never see
  a half-written file.
- Preserve last-known-good: on any fetch or validation failure the existing
  output files are left untouched.
"""

import os
import re
import time
import urllib.request

USER_AGENT = "Mozilla/5.0 (compatible; OskiHub-parking-events/1.0; +https://oski.app)"
FETCH_TIMEOUT = 45
MAX_RETRIES = 3


def fetch_url(url: str, timeout: int = FETCH_TIMEOUT) -> str:
    """Fetch a URL with retries. Raises on final failure."""
    body, _ = _fetch(url, timeout, allow_404=False)
    return body


def fetch_url_or_none(url: str, timeout: int = FETCH_TIMEOUT) -> str | None:
    """Fetch a URL; return None on HTTP 404 (dead link), raise otherwise."""
    body, status = _fetch(url, timeout, allow_404=True)
    return None if status == 404 else body


def _fetch(url: str, timeout: int, allow_404: bool) -> tuple[str, int | None]:
    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                charset = resp.headers.get_content_charset() or "utf-8"
                return resp.read().decode(charset, errors="replace"), resp.status
        except urllib.error.HTTPError as e:
            if e.code == 404 and allow_404:
                return "", 404
            last_err = e
        except Exception as e:  # noqa: BLE001 - we retry on anything transient
            last_err = e
        time.sleep(2 * attempt)
    raise RuntimeError(f"fetch failed after {MAX_RETRIES} tries: {url} ({last_err})")


def atomic_write(path: str, content: str) -> None:
    """Write content to path atomically (temp + fsync + rename)."""
    tmp = f"{path}.tmp.{os.getpid()}"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(content)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


# ---------------------------------------------------------------- ICS helpers

def ics_escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def ics_fold(line: str) -> str:
    """Fold an ICS content line at 75 octets per RFC 5545."""
    encoded = line.encode("utf-8")
    if len(encoded) <= 75:
        return line
    out = []
    chunk = encoded[:75]
    out.append(chunk.decode("utf-8", errors="ignore"))
    rest = encoded[75:]
    while rest:
        chunk = rest[:74]
        out.append(" " + chunk.decode("utf-8", errors="ignore"))
        rest = rest[74:]
    return "\r\n".join(out)


def ics_dtstamp() -> str:
    return time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())


def validate_ics(text: str, min_events: int = 0) -> tuple[bool, str]:
    """Structural validation of generated ICS. Returns (ok, reason)."""
    if not text.startswith("BEGIN:VCALENDAR"):
        return False, "missing BEGIN:VCALENDAR"
    if "END:VCALENDAR" not in text:
        return False, "missing END:VCALENDAR"
    begins = len(re.findall(r"BEGIN:VEVENT", text))
    ends = len(re.findall(r"END:VEVENT", text))
    if begins != ends:
        return False, f"unbalanced VEVENT blocks ({begins} begin / {ends} end)"
    if begins < min_events:
        return False, f"only {begins} events, expected at least {min_events}"
    return True, f"{begins} events OK"
