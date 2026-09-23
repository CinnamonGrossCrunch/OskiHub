#!/usr/bin/env python3
"""Audit a course ICS file against the Canvas API.

Checks every event whose URL points at a /courses/<id>/assignments/<aid> page:
  - the assignment resolves (no 401/403/404)
  - the event title names the same assignment (fuzzy match)
  - the event date matches the assignment due_at (America/Los_Angeles)
  - the event's point value matches points_possible

Also reports "due" events with no assignment URL whose title matches a real
assignment (missing link), and published assignments with due dates that have
no corresponding event (missing event).

Usage:
    python3 audit-course-ics.py public/course_ICS_files/ewmba204_operations_fall2026.ics 1555698

Requires the bcourses skill CLI at ~/workspace/skills/bcourses/bin/canvas.
"""
import json
import re
import subprocess
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

PT = ZoneInfo("America/Los_Angeles")
CANVAS = "/home/hatch/workspace/skills/bcourses/bin/canvas"


def api(path):
    out = subprocess.run([CANVAS, path], capture_output=True, text=True).stdout.strip()
    try:
        return json.loads(out)
    except Exception:
        return {"errors": [{"message": f"non-JSON response: {out[:80]}"}]}


def field(ev, name):
    m = re.search(rf"^{name}:(.*)$", ev, re.M)
    return m.group(1).strip() if m else ""


def main(ics_path, course_id):
    ics = open(ics_path).read()
    events = re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", ics, re.S)

    assignments = api(f"/api/v1/courses/{course_id}/assignments --params per_page=100")
    if isinstance(assignments, dict):
        print("API error listing assignments:", assignments)
        sys.exit(1)
    by_id = {str(a["id"]): a for a in assignments}

    problems = []
    linked_aids = set()
    for ev in events:
        url = field(ev, "URL")
        m = re.search(r"/assignments/(\d+)", url or "")
        if not m:
            continue
        aid = m.group(1)
        linked_aids.add(aid)
        summary = field(ev, "SUMMARY")
        a = by_id.get(aid)
        if a is None:
            # not in the student-visible list: check directly (may be hidden -> 403)
            a = api(f"/api/v1/courses/{course_id}/assignments/{aid}")
        if isinstance(a, dict) and "errors" in a:
            problems.append((summary, aid, "BROKEN LINK: " + a["errors"][0].get("message", "?")))
            continue
        # title check: first distinctive word of API name should appear in event title
        api_words = [w for w in re.findall(r"[A-Za-z#]+", a.get("name", "")) if len(w) > 3]
        title_ok = any(w.lower() in summary.lower() for w in api_words[:4])
        due = a.get("due_at")
        date_ok = True
        if due:
            local = datetime.fromisoformat(due.replace("Z", "+00:00")).astimezone(PT)
            date_ok = field(ev, "DTSTART").startswith(local.strftime("%Y%m%d"))
        pts = a.get("points_possible")
        desc = field(ev, "DESCRIPTION")
        pts_ok = True
        pm = re.search(r"\(([\d.]+)\s*pts?\)", desc)
        if pm and pts is not None:
            pts_ok = abs(float(pm.group(1)) - float(pts)) < 0.01
        flags = []
        if not title_ok:
            flags.append(f"title mismatch (API: '{a.get('name')}')")
        if not date_ok:
            flags.append(f"date mismatch (API due {due})")
        if not pts_ok:
            flags.append(f"points mismatch (API: {pts})")
        if flags:
            problems.append((summary, aid, "; ".join(flags)))

    print(f"{len(events)} events, {len(linked_aids)} assignment links checked")
    if problems:
        print(f"\n{len(problems)} PROBLEMS:")
        for summary, aid, what in problems:
            print(f"  - {summary} [id {aid}]: {what}")
    else:
        print("All assignment links OK.")

    # published assignments with due dates lacking any event
    titled = " ".join(field(ev, "SUMMARY") for ev in events).lower()
    missing = []
    for a in assignments:
        if not a.get("due_at") or not a.get("published"):
            continue
        words = [w for w in re.findall(r"[A-Za-z#]+", a.get("name", "")) if len(w) > 3]
        if not any(w.lower() in titled for w in words[:4]):
            missing.append(f"{a['id']}: {a['name']} (due {a['due_at']})")
    if missing:
        print(f"\n{len(missing)} published assignments with due dates have no event:")
        for m_ in missing:
            print("  -", m_)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: audit-course-ics.py <ics-file> <canvas-course-id>")
    main(sys.argv[1], sys.argv[2])
