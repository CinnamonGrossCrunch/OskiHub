#!/usr/bin/env python3
"""Canvas ingestion adapter — the truth layer.

Pulls assignments for every course in courses.json and writes raw,
unmerged truth to lib/generated/courses/<courseId>.canvas.json.

One adapter per SOURCE (not per course): adding a course is one JSON entry.

Usage: python3 canvas-ingest.py [--course <courseId>]
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(HERE, "..", "..")
CANVAS = "/home/hatch/workspace/skills/bcourses/bin/canvas"
OUTDIR = os.path.join(REPO, "lib", "generated", "courses")


def api(*argv):
    out = subprocess.run([CANVAS, *argv], capture_output=True, text=True)
    try:
        return json.loads(out.stdout.strip())
    except Exception:
        return {"errors": [{"message": f"non-JSON: {out.stdout[:100]} {out.stderr[:100]}"}]}


def ingest(course_id, canvas_id):
    assignments = api(f"/api/v1/courses/{canvas_id}/assignments",
                      "--params", "per_page=100")
    if isinstance(assignments, dict):  # error payload -> unpublished?
        course = api(f"/api/v1/courses/{canvas_id}")
        if isinstance(course, dict) and course.get("errors"):
            return {"courseId": course_id, "canvasCourseId": canvas_id,
                    "unpublished": True, "syncedAt": None, "assignments": []}
        raise RuntimeError(f"Canvas error for {course_id}: {assignments}")
    from datetime import datetime, timezone
    import re as _re
    # Module pages -> plain text (evidence for scaffold-only requirements)
    pages = []
    modules = api(f"/api/v1/courses/{canvas_id}/modules", "--params", "per_page=100")
    if isinstance(modules, list):
        for mod in modules:
            items = api(f"/api/v1/courses/{canvas_id}/modules/{mod['id']}/items",
                        "--params", "per_page=100")
            if not isinstance(items, list):
                continue
            for it in items:
                if it.get("type") != "Page" or not it.get("url"):
                    continue
                pg = api(it["url"].replace("https://bcourses.berkeley.edu", ""))
                if isinstance(pg, dict) and pg.get("body"):
                    text = _re.sub(r"<[^>]+>", " ", pg["body"])
                    text = _re.sub(r"\s+", " ", text).strip()
                    pages.append({"title": it.get("title", "?"), "text": text})
    return {
        "courseId": course_id,
        "canvasCourseId": canvas_id,
        "syncedAt": datetime.now(timezone.utc).isoformat(),
        "assignments": [{
            "id": a["id"],
            "name": a.get("name", ""),
            "dueAt": a.get("due_at"),
            "pointsPossible": a.get("points_possible"),
            "published": a.get("published", True),
            "htmlUrl": a.get("html_url", ""),
        } for a in assignments],
        "pages": pages,
    }


def main():
    only = None
    if "--course" in sys.argv:
        only = sys.argv[sys.argv.index("--course") + 1]
    courses = json.load(open(os.path.join(HERE, "courses.json")))["courses"]
    os.makedirs(OUTDIR, exist_ok=True)
    for c in courses:
        if only and c["courseId"] != only:
            continue
        if not c.get("canvasId"):
            print(f"{c['courseId']}: no Canvas ID — skipping (unpublished?)")
            continue
        data = ingest(c["courseId"], c["canvasId"])
        path = os.path.join(OUTDIR, f"{c['courseId']}.canvas.json")
        json.dump(data, open(path, "w"), indent=2, sort_keys=True)
        n = len(data["assignments"])
        flag = " (UNPUBLISHED)" if data.get("unpublished") else ""
        print(f"{c['courseId']}: wrote {path} ({n} assignments){flag}")


if __name__ == "__main__":
    main()
