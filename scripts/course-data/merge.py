#!/usr/bin/env python3
"""Merge layer: Canvas truth over scaffold narrative.

    lib/generated/courses/<id>.canvas.json   (truth)
  + lib/generated/courses/<id>.scaffold.json (narrative)
  = lib/generated/courses/<id>.json          (what the app reads)

Rules:
  1. Every published Canvas assignment with a due date -> CourseAssignment.
     Canvas wins on due date / points / URL. Always.
  2. Scaffold due-events matching a Canvas assignment -> merged: scaffold
     title + UID preserved (UI stability), Canvas date/points/URL,
     scaffold description kept as narrative.
  3. Scaffold due-events with no Canvas match but a course-page requirement ->
     provenance 'scaffold', unverified=True (kept, visibly marked).
  4. Scaffold due-events with no evidence -> dropped (ghosts), listed here.
  5. Scaffold sessions -> CourseSession verbatim (narrative layer untouched).
  6. Due:/Reflection: claims inside session descriptions are re-verified;
     mismatches are reported (prose is fixed by humans in the scaffold).

Deterministic: same inputs -> byte-identical outputs (diffable in git).

Usage: python3 merge.py [--course <courseId>]
"""
import json
import os
import re
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from textmatch import best_match, core_title, match_score, numbers, tokens

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(HERE, "..", "..")
GENDIR = os.path.join(REPO, "lib", "generated", "courses")
PT = ZoneInfo("America/Los_Angeles")
DUE_WORDS = re.compile(r"\b(due|submit|submission|deadline|assignment|by \d|turn in)\b", re.I)


def load(course_id, suffix):
    p = os.path.join(GENDIR, f"{course_id}.{suffix}.json")
    return json.load(open(p)) if os.path.exists(p) else None


def ics_to_iso(dtstart):
    """'20260923T180000' (floating PT) -> '2026-09-23T18:00:00-07:00'."""
    m = re.match(r"(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})", dtstart or "")
    if not m:
        return None
    y, mo, d, h, mi, s = map(int, m.groups())
    return datetime(y, mo, d, h, mi, s, tzinfo=PT).isoformat()


def utc_to_pt_iso(due_at):
    if not due_at:
        return None
    return datetime.fromisoformat(due_at.replace("Z", "+00:00")).astimezone(PT).isoformat()


def add_minutes(iso, minutes):
    return (datetime.fromisoformat(iso) + timedelta(minutes=minutes)).isoformat()


def page_mention(core, pages):
    """(kind, page_title) or None. Requirement mentions beat casual ones."""
    toks = [t for t in tokens(core) if len(t) > 3]
    if not toks:
        return None
    core_nums = numbers(core)
    best = None
    for pg in pages or []:
        low = pg["text"].lower()
        need = min(2, len(toks))
        pat = r".{0,80}" + r".{0,40}".join(re.escape(t) for t in toks[:3]) + r".{0,80}"
        for m in re.finditer(pat, low):
            window = m.group(0)
            if sum(1 for t in toks if t in window) < need:
                continue
            if core_nums and not (core_nums & set(re.findall(r"#?(\d+)", window))):
                continue
            kind = "requirement" if DUE_WORDS.search(window) else "casual"
            if kind == "requirement":
                return (kind, pg["title"])
            best = (kind, pg["title"])
    return best


def clean_claim_name(item):
    name = re.split(r"\s+—\s*", item)[0]
    name = re.sub(r"\bdue\b.*$", "", name, flags=re.I).strip(" ,")
    name = re.sub(r"\bby\b.*$", "", name, flags=re.I).strip(" ,")
    name = re.sub(r"\b(mon|tue|tues|wed|thu|thur|fri|sat|sun)[a-z]*\b.*$",
                  "", name, flags=re.I).strip(" ,")
    name = re.sub(r"\d{1,2}:\d{2}\s*(AM|PM)?.*$", "", name, flags=re.I).strip(" ,")
    name = re.sub(r"\d{1,2}/\d{1,2}.*$", "", name).strip(" ,")
    return name


def check_claims(sessions, assignments):
    """Re-verify Due:/Reflection: claims embedded in session descriptions."""
    issues = []
    for s in sessions:
        desc = s.get("description", "")
        for pat in (r"Due:\s*([^\n]+)", r"Reflection:\s*([^\n]+)"):
            for m in re.finditer(pat, desc):
                for item in m.group(1).split(";"):
                    item = item.strip(" ;")
                    if not item:
                        continue
                    name = clean_claim_name(item)
                    if not name:
                        continue
                    score, best = best_match(name, assignments, key=lambda a: a["name"])
                    if best and score >= 0.7:
                        dm = re.search(r"(\d{1,2})/(\d{1,2})", item)
                        if dm:
                            claim_day = f"2026-{int(dm.group(1)):02d}-{int(dm.group(2)):02d}"
                            canvas_day = (utc_to_pt_iso(best["dueAt"]) or "")[:10]
                            if canvas_day and claim_day != canvas_day:
                                issues.append({
                                    "session": s["title"], "claim": item,
                                    "issue": f"claims {claim_day}, Canvas says {canvas_day}",
                                })
                    # no-assignment claims are scaffold prose; the audit gate
                    # covers them — merge doesn't rewrite narrative.
    return issues


def merge_course(course):
    cid = course["courseId"]
    canvas = load(cid, "canvas")
    scaffold = load(cid, "scaffold")
    report = {"courseId": cid, "merged": 0, "canvasOnly": 0,
              "scaffoldKept": 0, "ghostsDropped": [], "claimIssues": []}

    canvas_assignments = []
    pages = []
    synced_at = None
    if canvas and not canvas.get("unpublished"):
        synced_at = canvas.get("syncedAt")
        pages = canvas.get("pages", [])
        canvas_assignments = [a for a in canvas["assignments"]
                              if a.get("published", True)]

    assignments_out = []
    sessions_out = []
    matched_ids = set()

    # --- scaffold due-events: merge or classify
    for ev in (scaffold or {}).get("dueEvents", []):
        core = ev.get("core") or core_title(ev["title"])
        score, best = best_match(core, canvas_assignments, key=lambda a: a["name"])
        if best and score >= 0.7:
            matched_ids.add(best["id"])
            due_iso = utc_to_pt_iso(best["dueAt"])
            assignments_out.append({
                "id": f"canvas:{best['id']}",
                "courseId": cid,
                "title": ev["title"],  # scaffold title: UI stability
                "dueAt": due_iso,      # Canvas: truth
                "pointsPossible": best["pointsPossible"],
                "url": best["htmlUrl"] or ev["url"],
                "provenance": "merged",
                "scaffoldNote": ev["description"] or None,
                "scaffoldUid": ev["uid"] or None,
            })
            report["merged"] += 1
        else:
            mention = page_mention(core, pages)
            if mention and mention[0] == "requirement":
                start_iso = ics_to_iso(ev["start"])
                assignments_out.append({
                    "id": f"scaffold:{cid}:{ev['uid'] or core}",
                    "courseId": cid,
                    "title": ev["title"],
                    "dueAt": start_iso,
                    "pointsPossible": None,
                    "url": ev["url"] or f"https://bcourses.berkeley.edu/courses/{course.get('canvasId')}",
                    "provenance": "scaffold",
                    "unverified": True,
                    "scaffoldNote": (f"Required per course page '{mention[1]}'; "
                                     f"not a Canvas assignment.") ,
                    "scaffoldUid": ev["uid"] or None,
                })
                report["scaffoldKept"] += 1
            else:
                report["ghostsDropped"].append({
                    "title": ev["title"],
                    "reason": ("only a casual page mention" if mention
                               else "no Canvas assignment or page evidence"),
                })

    # --- Canvas assignments with no scaffold event -> first-class truth
    for a in canvas_assignments:
        if a["id"] in matched_ids or not a.get("dueAt"):
            continue
        due_iso = utc_to_pt_iso(a["dueAt"])
        pts = a["pointsPossible"]
        pts_txt = f" ({pts} pts)" if pts else ""
        assignments_out.append({
            "id": f"canvas:{a['id']}",
            "courseId": cid,
            "title": f"{course['shortTitle']} — {a['name']} due",
            "dueAt": due_iso,
            "pointsPossible": pts,
            "url": a["htmlUrl"],
            "provenance": "canvas",
            "scaffoldNote": None,
        })
        report["canvasOnly"] += 1

    # --- sessions: narrative layer, verbatim
    for s in (scaffold or {}).get("sessions", []):
        sessions_out.append({
            "id": f"scaffold:{cid}:{s['uid'] or s['title']}",
            "courseId": cid,
            "title": s["title"],
            "start": ics_to_iso(s["start"]),
            "end": ics_to_iso(s["end"]),
            "location": s["location"] or None,
            "description": s["description"] or None,
            "provenance": "scaffold",
            "scaffoldUid": s["uid"] or None,
        })

    report["claimIssues"] = check_claims(sessions_out, [
        {"name": a["name"], "dueAt": a["dueAt"]} for a in canvas_assignments])

    # deterministic order: by due date, scaffold-kept last
    assignments_out.sort(key=lambda a: (a["dueAt"] or "9999", a["title"]))
    sessions_out.sort(key=lambda s: (s["start"] or "9999", s["title"]))

    data = {
        "courseId": cid,
        "canvasCourseId": course.get("canvasId"),
        "title": course["title"],
        "term": course["term"],
        "assignments": assignments_out,
        "sessions": sessions_out,
        "generatedAt": datetime.now(PT).isoformat(),
        "canvasSyncedAt": synced_at,
        "droppedGhosts": report["ghostsDropped"],
    }
    return data, report


def main():
    only = None
    if "--course" in sys.argv:
        only = sys.argv[sys.argv.index("--course") + 1]
    courses = json.load(open(os.path.join(HERE, "courses.json")))["courses"]
    full_report = {}
    for c in courses:
        if only and c["courseId"] != only:
            continue
        data, report = merge_course(c)
        path = os.path.join(GENDIR, f"{c['courseId']}.json")
        json.dump(data, open(path, "w"), indent=2, sort_keys=True)
        full_report[c["courseId"]] = report
        print(f"{c['courseId']}: {len(data['assignments'])} assignments "
              f"({report['merged']} merged, {report['canvasOnly']} canvas-only, "
              f"{report['scaffoldKept']} scaffold-kept), "
              f"{len(data['sessions'])} sessions, "
              f"{len(report['ghostsDropped'])} ghosts dropped, "
              f"{len(report['claimIssues'])} claim issues")
        for g in report["ghostsDropped"]:
            print(f"    ghost: {g['title']} ({g['reason']})")
        for ci in report["claimIssues"]:
            print(f"    claim: [{ci['session']}] {ci['claim']} — {ci['issue']}")
    rp = os.path.join(GENDIR, "merge-report.json")
    json.dump(full_report, open(rp, "w"), indent=2, sort_keys=True)


if __name__ == "__main__":
    main()
