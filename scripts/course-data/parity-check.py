#!/usr/bin/env python3
"""Parity check: legacy ICS parse vs course-data generated JSON (EW204).

Compares, per VEVENT in the hand-built ICS, the (uid, title, start, end)
the old icsUtils parser would have produced against the merged dataset.
Canvas-truth date corrections are reported separately (by design), not as
failures. Canvas-only additions (previously invisible assignments) are
expected and listed.
"""
import json, re, sys
from datetime import datetime
from zoneinfo import ZoneInfo

REPO = "/home/hatch/workspace/oskihub/repo"
PT = ZoneInfo("America/Los_Angeles")

def unescape(s):
    return s.replace("\\n", "\n").replace("\\,", ",").replace("\\;", ";")

raw = open(f"{REPO}/public/course_ICS_files/ewmba204_operations_fall2026.ics").read()
ics_events = []
for block in re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", raw, re.S):
    def f(name):
        m = re.search(rf"^{name}:(.*)$", block, re.M)
        return unescape(m.group(1).strip()) if m else ""
    def instant(dt):
        m = re.match(r"(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})", dt or "")
        if not m: return None
        return datetime(*map(int, m.groups()), tzinfo=PT).astimezone(ZoneInfo("UTC")).isoformat()
    ics_events.append({"uid": f("UID"), "title": f("SUMMARY"),
                       "start": instant(f("DTSTART")), "end": instant(f("DTEND")),
                       "desc": f("DESCRIPTION")})

data = json.load(open(f"{REPO}/lib/generated/courses/ew204.json"))
by_uid = {}
for a in data["assignments"]:
    if a.get("scaffoldUid"):
        by_uid[a["scaffoldUid"]] = ("assignment", a)
for s in data["sessions"]:
    if s.get("scaffoldUid"):
        by_uid[s["scaffoldUid"]] = ("session", s)

ok = corrected = missing = 0
for ev in ics_events:
    hit = by_uid.get(ev["uid"])
    if not hit:
        missing += 1
        print(f"MISSING in generated: {ev['title'][:60]}")
        continue
    kind, obj = hit
    gen_start = datetime.fromisoformat(obj.get("dueAt") or obj["start"]).astimezone(ZoneInfo("UTC")).isoformat()
    gen_end_src = obj.get("dueAt")
    if kind == "assignment" and obj["provenance"] in ("merged", "scaffold"):
        # merged/scaffold assignments: 30-min duration like legacy due events
        gen_end = (datetime.fromisoformat(obj["dueAt"]) +
                   __import__("datetime").timedelta(minutes=30)).astimezone(ZoneInfo("UTC")).isoformat()
    else:
        gen_end = datetime.fromisoformat(obj["end"]).astimezone(ZoneInfo("UTC")).isoformat() if obj.get("end") else None
    title_ok = (obj["title"] == ev["title"])
    if gen_start == ev["start"] and gen_end == ev["end"] and title_ok:
        ok += 1
    else:
        corrected += 1
        print(f"DIFF [{obj['provenance']}] {ev['title'][:55]}")
        if not title_ok: print(f"   title: {ev['title']!r} -> {obj['title']!r}")
        if gen_start != ev["start"]: print(f"   start: {ev['start']} -> {gen_start}")
        if gen_end != ev["end"]: print(f"   end:   {ev['end']} -> {gen_end}")

new_canvas = [a for a in data["assignments"] if a["provenance"] == "canvas"]
print(f"\nparity: {ok} identical, {corrected} canvas-corrected, {missing} missing")
print(f"canvas-only additions (by design): {len(new_canvas)}")
for a in new_canvas:
    print(f"   + {a['title'][:60]} due={str(a['dueAt'])[:16]}")
print(f"sessions: {len(data['sessions'])} (legacy had {sum(1 for e in ics_events if e['uid'] not in [a.get('scaffoldUid') for a in data['assignments']])} non-due events)")
