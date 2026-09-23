#!/usr/bin/env python3
"""bCourses change watcher: snapshot + diff for Fall 2026 courses.

Polls the read-only Canvas API for assignments, modules, files, and
announcements in each watched course, compares against a local JSON
snapshot, and prints a human-readable diff. The first run establishes
the baseline and reports nothing.

Usage:
    watch.py [--snapshot PATH]

Stdout carries the diff (or NO CHANGES / BASELINE ESTABLISHED).
The snapshot is rewritten on every successful run.
Exit code is always 0 on success, 2 on API failure (snapshot untouched).
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

CANVAS_CLI = os.path.expanduser("~/workspace/skills/bcourses/bin/canvas")

# course_id -> short label. Only published, API-visible courses.
COURSES = {
    "1555698": "EW204 Operations",
    "1555570": "EW200C Leadership Communication",
    # EW209 Strategic Leadership is unpublished as of 2026-09-22; add when live.
}

DEFAULT_SNAPSHOT = os.path.expanduser(
    "~/workspace/goals/oskihub-fall-2026-refresh/hidden_files/"
    "bcourses-watch/snapshot.json"
)


def canvas(path: str, params: dict[str, str] | None = None):
    cmd = [CANVAS_CLI, path]
    for key, value in (params or {}).items():
        cmd += ["--params", f"{key}={value}"]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if proc.returncode != 0:
        raise RuntimeError(f"canvas {path} failed:\n{proc.stderr.strip()}")
    return json.loads(proc.stdout)


def fetch_course(course_id: str) -> dict:
    assignments = {
        str(a["id"]): {
            "name": a.get("name"),
            "due_at": a.get("due_at"),
            "unlock_at": a.get("unlock_at"),
            "published": a.get("published"),
            "points": a.get("points_possible"),
        }
        for a in canvas(f"/api/v1/courses/{course_id}/assignments",
                        {"per_page": "100", "order_by": "due_at"})
    }
    modules = {
        str(m["id"]): {
            "name": m.get("name"),
            "position": m.get("position"),
            "published": m.get("published"),
            "items_count": m.get("items_count"),
        }
        for m in canvas(f"/api/v1/courses/{course_id}/modules",
                        {"per_page": "100"})
    }
    try:
        files = {
            str(f["id"]): {
                "name": f.get("display_name"),
                "size": f.get("size"),
                "updated_at": f.get("updated_at"),
            }
            for f in canvas(f"/api/v1/courses/{course_id}/files",
                            {"per_page": "100"})
        }
    except RuntimeError as exc:
        # Some courses forbid file listing for students (403). Watch the
        # rest of the course and skip file diffing rather than failing.
        if "HTTP 403" not in str(exc):
            raise
        files = None
    announcements = {
        str(t["id"]): {
            "title": t.get("title"),
            "posted_at": t.get("posted_at"),
            "author": (t.get("author") or {}).get("display_name"),
        }
        for t in canvas(
            f"/api/v1/courses/{course_id}/discussion_topics",
            {"only_announcements": "true", "order_by": "posted_at",
             "per_page": "20"})
    }
    return {
        "assignments": assignments,
        "modules": modules,
        "files": files,
        "announcements": announcements,
    }


def diff_course(label: str, old: dict, new: dict) -> list[str]:
    lines: list[str] = []

    for aid, a in new["assignments"].items():
        o = old["assignments"].get(aid)
        if o is None:
            lines.append(
                f"[{label}] NEW ASSIGNMENT: {a['name']} "
                f"(due {a['due_at']}, {a['points']} pts, "
                f"published={a['published']})")
        else:
            if a["due_at"] != o["due_at"]:
                lines.append(
                    f"[{label}] DUE DATE CHANGED: {a['name']}: "
                    f"{o['due_at']} -> {a['due_at']}")
            if a["published"] != o["published"]:
                lines.append(
                    f"[{label}] PUBLISHED: {a['name']} "
                    f"(published={a['published']})")
            if a["points"] != o["points"]:
                lines.append(
                    f"[{label}] POINTS CHANGED: {a['name']}: "
                    f"{o['points']} -> {a['points']}")
    for aid, o in old["assignments"].items():
        if aid not in new["assignments"]:
            lines.append(f"[{label}] ASSIGNMENT REMOVED: {o['name']}")

    for mid, m in new["modules"].items():
        o = old["modules"].get(mid)
        if o is None:
            lines.append(f"[{label}] NEW MODULE: {m['name']}")
        elif m["items_count"] != o["items_count"] or \
                m["published"] != o["published"]:
            lines.append(
                f"[{label}] MODULE UPDATED: {m['name']} "
                f"(items {o['items_count']}->{m['items_count']}, "
                f"published={m['published']})")

    if old.get("files") is not None and new.get("files") is not None:
        for fid, f in new["files"].items():
            if fid not in old["files"]:
                lines.append(f"[{label}] NEW FILE: {f['name']}")

    for tid, t in new["announcements"].items():
        if tid not in old["announcements"]:
            lines.append(
                f"[{label}] NEW ANNOUNCEMENT: {t['title']} "
                f"(by {t['author']}, {t['posted_at']})")

    return lines


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="bCourses snapshot-diff watcher")
    ap.add_argument("--snapshot", default=DEFAULT_SNAPSHOT)
    args = ap.parse_args(argv)

    fresh: dict = {}
    try:
        for cid, label in COURSES.items():
            fresh[cid] = {"label": label, **fetch_course(cid)}
    except RuntimeError as exc:
        print(f"WATCHER ERROR: {exc}", file=sys.stderr)
        return 2

    if not os.path.exists(args.snapshot):
        os.makedirs(os.path.dirname(args.snapshot), exist_ok=True)
        with open(args.snapshot, "w") as fh:
            json.dump(fresh, fh, indent=2, sort_keys=True)
        print("BASELINE ESTABLISHED — snapshot saved, no alerts on first run.")
        return 0

    with open(args.snapshot) as fh:
        old = json.load(fh)

    changes: list[str] = []
    for cid, label in COURSES.items():
        if cid not in old:
            changes.append(f"[{label}] started being watched; baseline taken.")
        else:
            changes.extend(diff_course(label, old[cid], fresh[cid]))

    with open(args.snapshot, "w") as fh:
        json.dump(fresh, fh, indent=2, sort_keys=True)

    if not changes:
        print("NO CHANGES.")
    else:
        print(f"{len(changes)} CHANGE(S) DETECTED:")
        for line in changes:
            print(" -", line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
