#!/usr/bin/env python3
"""Scaffold ingestion adapter — the narrative layer.

Parses the hand-built course ICS into sessions (topics, readings,
descriptions) and due-event narratives. From here on, the scaffold owns
STORY (descriptions, topics, readings) and never dates/points — those come
from the Canvas truth layer at merge time.

Usage: python3 scaffold-ingest.py [--course <courseId>]
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from textmatch import core_title

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(HERE, "..", "..")
OUTDIR = os.path.join(REPO, "lib", "generated", "courses")


def unescape(s):
    return s.replace("\\n", "\n").replace("\\,", ",").replace("\\;", ";")


def parse_ics(path):
    raw = open(path, encoding="utf-8").read()
    events = []
    for block in re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", raw, re.S):
        def field(name):
            m = re.search(rf"^{name}:(.*)$", block, re.M)
            return unescape(m.group(1).strip()) if m else ""
        # unfold folded lines for the fields we read
        events.append({
            "uid": field("UID"),
            "title": field("SUMMARY"),
            "description": field("DESCRIPTION"),
            "start": field("DTSTART"),
            "end": field("DTEND"),
            "location": field("LOCATION"),
            "url": field("URL"),
        })
    return events


def is_due_like(ev):
    if re.search(r"\bdue\b", ev["title"], re.I):
        return True
    if re.search(r"\(\d+(\.\d+)?\s*pts?\)", ev["description"], re.I):
        return True
    return False


def ingest(course):
    path = os.path.join(REPO, course["ics"])
    events = parse_ics(path)
    sessions, due_events = [], []
    for ev in events:
        if is_due_like(ev):
            due_events.append({**ev, "core": core_title(ev["title"])})
        else:
            sessions.append(ev)
    return {
        "courseId": course["courseId"],
        "sourceFile": course["ics"],
        "sessions": sessions,
        "dueEvents": due_events,
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
        data = ingest(c)
        path = os.path.join(OUTDIR, f"{c['courseId']}.scaffold.json")
        json.dump(data, open(path, "w"), indent=2, sort_keys=True)
        print(f"{c['courseId']}: {len(data['sessions'])} sessions, "
              f"{len(data['dueEvents'])} due-events -> {path}")


if __name__ == "__main__":
    main()
