"""Fetch and filter the official Cal Athletics composite calendar.

Source: https://calbears.com/calendar.ics (SIDEARM Sports feed)
The feed contains ALL sports: away games, neutral-site games, minor events.
We keep only home events in Berkeley and classify parking impact by venue:

  HIGH   - Football at California Memorial Stadium. Stadium Rimway closes
           4h before kickoff; Piedmont Ave/Gayley Rd and Bancroft/Warring
           closures begin 2h before kickoff.
  LOW    - Other Berkeley venues (Edwards Stadium, Witter Rugby Field,
           tennis, etc.). Kept in the feed for the bear icon, but they do
           NOT trigger parking badges/banners.

Haas Pavilion events are EXCLUDED entirely — the arena is across campus
and its crowds do not affect parking near the business school.

Away games ("California X at Opponent", non-Berkeley LOCATION) are dropped.
"""

import re
from datetime import datetime, timezone

from common import fetch_url

FEED_URL = "https://calbears.com/calendar.ashx/calendar.ics"

# Campus venues that count as "home" even when LOCATION omits "Berkeley".
# (Haas Pavilion deliberately excluded: across campus, no parking impact.)
CAMPUS_VENUES = [
    "memorial stadium",
    "edwards stadium",
    "witter rugby field",
    "underhill field",
    "spieker aquatics",
    "hellman tennis",
    "levine-fricke",
    "evans diamond",
    "goldman field",
    "maxwell family field",
    "simpson center",
    "strawberry canyon",
]

RESULT_TAG_RE = re.compile(r"^\s*\[[WLNT]\]\s*")  # [W]in [L]oss [N]eutral [T]ie
AWAY_RE = re.compile(r"\bat\s+[A-Z]")  # "California X at Opponent"

FOOTBALL_NOTE = (
    "Cal football at Memorial Stadium (HIGH impact): "
    "Stadium Rimway closes 4h before kickoff; "
    "Piedmont Ave/Gayley Rd and Bancroft Ave/Warring St close 2h before. "
    "Expect severe parking pressure near campus."
)

# Haas Pavilion is across campus from the business school; its events are
# excluded from the feed entirely (no parking impact for Matt's commute).
EXCLUDED_VENUES = ("haas pavilion",)


def _unfold(text: str) -> str:
    return re.sub(r"\r?\n[ \t]", "", text)


def _parse_ics_events(text: str):
    text = _unfold(text)
    events = []
    for block in re.split(r"BEGIN:VEVENT", text)[1:]:
        block = block.split("END:VEVENT")[0]
        def prop(name):
            m = re.search(rf"^{name}(?:;[^:]*)?:(.*)$", block, re.M | re.I)
            return m.group(1).strip() if m else ""
        events.append({
            "uid": prop("UID"),
            "dtstart": prop("DTSTART"),
            "dtend": prop("DTEND"),
            "summary": prop("SUMMARY"),
            "location": prop("LOCATION").replace("\\,", ","),
            "url": prop("URL").replace("&amp;", "&"),
            "description": prop("DESCRIPTION").replace("\\n", "\n").replace("\\,", ","),
        })
    return events


def _is_home(summary: str, location: str) -> bool:
    loc = location.lower()
    in_berkeley = "berkeley" in loc or any(v in loc for v in CAMPUS_VENUES)
    if not in_berkeley:
        return False
    # Away games read "California X at Opponent" even with a Berkeley-ish venue
    # string; home games read "California X vs Opponent".
    if AWAY_RE.search(summary):
        return False
    return True


def _classify(location: str) -> tuple[str, str | None]:
    loc = location.lower()
    if "memorial stadium" in loc:
        return "high", FOOTBALL_NOTE
    return "low", None


def _normalize_title(summary: str) -> str:
    title = RESULT_TAG_RE.sub("", summary).strip()
    return re.sub(r"\s+", " ", title)


def fetch_calbears_events() -> list[dict]:
    raw = fetch_url(FEED_URL)
    parsed = _parse_ics_events(raw)
    out: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for ev in parsed:
        if not ev["dtstart"] or not ev["summary"]:
            continue
        if any(v in ev["location"].lower() for v in EXCLUDED_VENUES):
            continue  # Haas Pavilion: across campus, excluded from the feed
        if not _is_home(ev["summary"], ev["location"]):
            continue
        title = _normalize_title(ev["summary"])
        key = (ev["dtstart"], title)
        if key in seen:
            continue
        seen.add(key)
        severity, note = _classify(ev["location"])
        out.append({
            "uid": ev["uid"] or f"calbears-{ev['dtstart']}-{len(out)}",
            "dtstart": ev["dtstart"],   # passthrough, e.g. 20260926T020000Z
            "dtend": ev["dtend"],
            "title": f"Cal Bears: {title}",
            "location": ev["location"],
            "url": ev["url"],
            "description": ev["description"],
            "severity": severity,
            "note": note,
        })
    out.sort(key=lambda e: e["dtstart"])
    return out


if __name__ == "__main__":
    evs = fetch_calbears_events()
    from collections import Counter
    print(f"{len(evs)} home events")
    print(Counter(e["severity"] for e in evs))
    for e in evs:
        if e["severity"] == "high":
            print(e["dtstart"], "|", e["title"][:70])
