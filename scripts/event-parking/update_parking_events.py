"""Orchestrator: refresh the parking-event data files.

Runs each source (Cal Bears ICS, Greek Theatre scrape, campus stub),
builds normalized ICS feeds + a manifest, validates everything, and writes
outputs ATOMICALLY. On any fetch or validation failure the last-known-good
files are preserved — we never ship an empty or corrupt feed.

Outputs (all committed to the repo):
  public/parking-events/cal_bears_home.ics   - filtered Cal Bears home events
  public/parking-events/greek_theater.ics    - Greek Theatre concerts
  public/parking-events/manifest.json        - freshness metadata + coverage notes
  lib/generated/greekTheaterEvents.ts        - typed TS module for the UI

Severity travels inside the ICS as X-PARKING-SEVERITY / X-PARKING-NOTE
(custom properties the UI extracts); the Greek TS module carries it as data.

Usage:
  python3 update_parking_events.py [--force]
  --force: run even if a fresh manifest already exists (cron uses this flag
           only via the seasonal wrapper logic in the schedule definition)
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from common import atomic_write, ics_escape, ics_fold, ics_dtstamp, validate_ics  # noqa: E402
from fetch_calbears import fetch_calbears_events  # noqa: E402
from scrape_greek import scrape_greek_events  # noqa: E402
from fetch_campus import fetch_campus_events, COVERAGE_NOTE  # noqa: E402

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(REPO, "public", "parking-events")
GEN_TS = os.path.join(REPO, "lib", "generated", "greekTheaterEvents.ts")
MANIFEST = os.path.join(OUT_DIR, "manifest.json")

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def _parse_feed_dt(raw: str):
    """'20260926T020000Z' -> datetime; '20260926' -> date-only datetime."""
    raw = raw.strip()
    if raw.endswith("Z"):
        return datetime.strptime(raw, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
    m = re.match(r"(\d{8})T(\d{6})", raw)
    if m:
        return datetime.strptime(raw[:15], "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc)
    return datetime.strptime(raw[:8], "%Y%m%d").replace(tzinfo=timezone.utc)


def _fmt_dt_utc(dt) -> str:
    return dt.strftime("%Y%m%dT%H%M%SZ")


def build_calbears_ics(events: list[dict]) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//OskiHub//Parking Events//EN",
        "X-WR-CALNAME:Cal Bears home events (parking impact)",
    ]
    for e in events:
        dt = _parse_feed_dt(e["dtstart"])
        lines.append("BEGIN:VEVENT")
        lines.append(ics_fold(f"UID:{e['uid']}@oskihub.parking"))
        lines.append(f"DTSTAMP:{ics_dtstamp()}")
        lines.append(f"DTSTART:{_fmt_dt_utc(dt)}")
        if e.get("dtend"):
            try:
                lines.append(f"DTEND:{_fmt_dt_utc(_parse_feed_dt(e['dtend']))}")
            except ValueError:
                pass
        lines.append(ics_fold(f"SUMMARY:{ics_escape(e['title'])}"))
        lines.append(ics_fold(f"LOCATION:{ics_escape(e['location'])}"))
        if e.get("url"):
            lines.append(ics_fold(f"URL:{e['url']}"))
        desc = e.get("description") or ""
        if e.get("note"):
            desc = f"{e['note']}\n\n{desc}".strip()
        if desc:
            lines.append(ics_fold(f"DESCRIPTION:{ics_escape(desc[:2000])}"))
        lines.append(f"X-PARKING-SEVERITY:{e['severity'].upper()}")
        if e.get("note"):
            lines.append(ics_fold(f"X-PARKING-NOTE:{ics_escape(e['note'])}"))
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def _to_24h(t: str | None):
    """'5:30 pm' -> (17, 30). Returns None if unparseable."""
    if not t:
        return None
    m = re.match(r"(\d{1,2}):(\d{2})\s*([ap])m", t.strip(), re.I)
    if not m:
        return None
    h, mi, ap = int(m.group(1)), int(m.group(2)), m.group(3).lower()
    if ap == "p" and h != 12:
        h += 12
    if ap == "a" and h == 12:
        h = 0
    return h, mi


def build_greek_ics(events: list[dict]) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//OskiHub//Parking Events//EN",
        "X-WR-CALNAME:Greek Theatre concerts (parking impact)",
    ]
    for e in events:
        h24 = _to_24h(e.get("show_time")) or _to_24h(e.get("doors_time")) or (19, 0)
        # America/Los_Angeles wall time; UI parses TZID floats as PT already.
        dt = f"{e['year']:04d}{e['month']:02d}{e['day']:02d}T{h24[0]:02d}{h24[1]:02d}00"
        lines.append("BEGIN:VEVENT")
        lines.append(ics_fold(f"UID:{e['uid']}@oskihub.parking"))
        lines.append(f"DTSTAMP:{ics_dtstamp()}")
        lines.append(f"DTSTART;TZID=America/Los_Angeles:{dt}")
        lines.append(ics_fold(f"SUMMARY:{ics_escape(e['title'])}"))
        lines.append(ics_fold("LOCATION:Greek Theatre\\, Berkeley\\, CA"))
        lines.append(ics_fold(f"URL:{e['url']}"))
        desc = e["note"]
        if e.get("doors_time"):
            desc += f"\nDoors: {e['doors_time']}"
        if e.get("show_time"):
            desc += f"\nShow: {e['show_time']}"
        lines.append(ics_fold(f"DESCRIPTION:{ics_escape(desc)}"))
        lines.append(f"X-PARKING-SEVERITY:{e['severity'].upper()}")
        lines.append(ics_fold(f"X-PARKING-NOTE:{ics_escape(e['note'])}"))
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def build_greek_ts(events: list[dict]) -> str:
    """Typed TS module consumed by lib/greekTheater.ts."""
    def q(s):
        return json.dumps(s)
    parts = [
        "// GENERATED by scripts/event-parking/update_parking_events.py — do not edit by hand.",
        "// Regenerated on every parking-events refresh.",
        "",
        "export interface GeneratedGreekEvent {",
        "  year: number; month: number; day: number; // month is 1-based",
        "  title: string;",
        "  artist: string;",
        "  url: string;",
        "  showTime?: string;",
        "  doorsTime?: string;",
        "  severity: 'high' | 'medium' | 'low';",
        "  note?: string;",
        "}",
        "",
        "export const GENERATED_GREEK_EVENTS: GeneratedGreekEvent[] = [",
    ]
    for e in events:
        parts.append("  {")
        parts.append(f"    year: {e['year']}, month: {e['month']}, day: {e['day']},")
        parts.append(f"    title: {q(e['title'])},")
        parts.append(f"    artist: {q(e['artist'])},")
        parts.append(f"    url: {q(e['url'])},")
        if e.get("show_time"):
            parts.append(f"    showTime: {q(e['show_time'])},")
        if e.get("doors_time"):
            parts.append(f"    doorsTime: {q(e['doors_time'])},")
        parts.append(f"    severity: {q(e['severity'])},")
        parts.append(f"    note: {q(e['note'])},")
        parts.append("  },")
    parts.append("];")
    parts.append("")
    return "\n".join(parts)


def main() -> int:
    force = "--force" in sys.argv[1:]
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(GEN_TS), exist_ok=True)

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generator": "scripts/event-parking/update_parking_events.py",
        "forced": force,
        "sources": {},
    }
    results: dict[str, str] = {}  # name -> content to write (only on success)

    # ---- Cal Bears ----
    try:
        cb = fetch_calbears_events()
        ics = build_calbears_ics(cb)
        ok, reason = validate_ics(ics, min_events=1)
        if not ok:
            raise RuntimeError(f"validation failed: {reason}")
        results["cal_bears_home.ics"] = ics
        manifest["sources"]["calbears"] = {
            "status": "ok", "events": len(cb),
            "severity_counts": {s: sum(1 for e in cb if e["severity"] == s)
                                for s in ("high", "medium", "low")},
            "url": "https://calbears.com/calendar.ics",
        }
        print(f"calbears: {len(cb)} home events")
    except Exception as e:  # noqa: BLE001 - preserve last-good on ANY failure
        manifest["sources"]["calbears"] = {"status": "failed", "error": str(e)}
        print(f"calbears FAILED (keeping last-known-good): {e}")

    # ---- Greek Theatre ----
    try:
        gr = scrape_greek_events()
        if not gr:
            raise RuntimeError("scrape returned zero events")
        ics = build_greek_ics(gr)
        ok, reason = validate_ics(ics, min_events=1)
        if not ok:
            raise RuntimeError(f"validation failed: {reason}")
        results["greek_theater.ics"] = ics
        results["__greek_ts__"] = build_greek_ts(gr)
        manifest["sources"]["greek"] = {
            "status": "ok", "events": len(gr),
            "url": "https://thegreekberkeley.com/",
            "coverage": "concerts only; UC non-concert events are not listed by the Greek",
        }
        print(f"greek: {len(gr)} concerts")
    except Exception as e:  # noqa: BLE001
        manifest["sources"]["greek"] = {"status": "failed", "error": str(e)}
        print(f"greek FAILED (keeping last-known-good): {e}")

    # ---- Campus (stub) ----
    _, note = fetch_campus_events()
    manifest["sources"]["campus"] = {"status": "unavailable", "note": note}

    # ---- Atomic commit of outputs ----
    for name, content in results.items():
        if name == "__greek_ts__":
            atomic_write(GEN_TS, content)
        else:
            atomic_write(os.path.join(OUT_DIR, name), content)

    # Only write the manifest when at least one source succeeded; a total
    # failure leaves the previous manifest (and data) untouched.
    if results:
        atomic_write(MANIFEST, json.dumps(manifest, indent=2) + "\n")
        print(f"wrote {len(results)} output file(s) + manifest")
        return 0
    print("ALL SOURCES FAILED — no files written, last-known-good preserved")
    return 1


if __name__ == "__main__":
    sys.exit(main())
