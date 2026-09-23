#!/usr/bin/env python3
"""Cross-check a course ICS file against Canvas (assignments + module pages).

Catches the failure modes the URL-only audit missed:

  1. GHOST      - ICS "due" event with no backing Canvas assignment and no
                  requirement-like mention in course pages
                  (e.g. fabricated "Prepare Uber" 5-pt due event).
  2. MISSING    - Canvas assignment with a due date but no ICS event
                  (e.g. EW200C's ICS has zero due events for 19 assignments).
  3. MISMATCH   - ICS event matches an assignment but the date or claimed
                  points differ.
  4. MENTIONED  - real requirement in course pages but not a Canvas assignment
                  (keep the event; don't invent points).

Works across differently-configured courses: due-like VEVENTs are detected by
content ("X due" summaries, points claims), not per-course rules, and titles
are fuzzy-matched after normalization. Courses with no Canvas presence
(unpublished) report UNVERIFIABLE and are skipped.

Usage:
    python3 audit-course-ics-v2.py <ics_path> <canvas_course_id> [--prune] [--json]
    python3 audit-course-ics-v2.py --all [--prune]

    --all reads scripts/course-audit-config.json and audits every course.
    --prune deletes VEVENTs with verdict GHOST (writes a .bak first).
    Everything else is report-only.

Requires the bcourses skill CLI at ~/workspace/skills/bcourses/bin/canvas.
"""
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

PT = ZoneInfo("America/Los_Angeles")
CANVAS = "/home/hatch/workspace/skills/bcourses/bin/canvas"
CONFIG = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                      "course-audit-config.json")

STOPWORDS = {
    "operations", "leadership", "communication", "communications", "strategy",
    "strategic", "due", "the", "a", "an", "for", "my", "of", "and", "to",
    "ew204", "ew200c", "ew209", "1a", "1b", "2a",
}
DUE_WORDS = re.compile(r"\b(due|submit|submission|deadline|assignment|by \d|turn in)\b", re.I)


# ---------------------------------------------------------------- ICS parsing

def unescape_ics(s):
    return s.replace("\\n", "\n").replace("\\,", ",").replace("\\;", ";")


def parse_ics(path):
    raw = open(path, encoding="utf-8").read()
    events = []
    for block in re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", raw, re.S):
        def field(name):
            m = re.search(rf"^{name}:(.*)$", block, re.M)
            return unescape_ics(m.group(1).strip()) if m else ""
        events.append({
            "uid": field("UID"),
            "summary": field("SUMMARY"),
            "description": field("DESCRIPTION"),
            "dtstart": field("DTSTART"),
            "url": field("URL"),
            "block": block,
        })
    return events


def is_due_like(ev):
    """A VEVENT that represents a deliverable, detected by content."""
    if re.search(r"\bdue\b", ev["summary"], re.I):
        return True
    if re.search(r"\(\d+(\.\d+)?\s*pts?\)", ev["description"], re.I):
        return True
    return False


def claimed_points(ev):
    m = re.search(r"\((\d+(\.\d+)?)\s*pts?\)", ev["description"], re.I)
    return float(m.group(1)) if m else None


def event_day_pt(ev):
    """Calendar day of DTSTART in America/Los_Angeles (floating = PT)."""
    m = re.match(r"(\d{4})(\d{2})(\d{2})", ev["dtstart"] or "")
    if not m:
        return None
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"


# ---------------------------------------------------------------- title matching

def normalize(s):
    s = s.lower()
    s = re.sub(r"[^a-z0-9# ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def core_title(summary):
    """Strip course prefix and trailing 'due' -> comparable core."""
    s = re.sub(r"^.*?—\s*", "", summary)          # em-dash prefix ("Operations — ")
    s = re.sub(r"^.*?\-\s*", "", s) if "—" not in summary else s
    s = re.sub(r"\bdue\b\.?\s*$", "", s, flags=re.I).strip()
    return s


def tokens(s):
    return [t for t in normalize(s).split() if t not in STOPWORDS and len(t) > 1]


def numbers(s):
    return set(re.findall(r"#?(\d+)", normalize(s)))


def match_score(ics_core, canvas_name):
    """0..1 fuzzy match; number-aware so '#4' never matches '#3'."""
    a, b = normalize(ics_core), normalize(canvas_name)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if a in b or b in a:
        return 0.9
    na, nb = numbers(ics_core), numbers(canvas_name)
    if na and nb and na != nb:
        return 0.0  # both numbered, numbers differ -> different items
    ta, tb = set(tokens(ics_core)), set(tokens(canvas_name))
    if not ta or not tb:
        return 0.0
    inter = ta & tb
    distinctive = {t for t in inter if len(t) > 3 or t.isdigit()}
    ratio = len(inter) / min(len(ta), len(tb))
    if len(distinctive) >= 2 and ratio >= 0.6:
        return 0.8
    if len(distinctive) >= 1 and ratio >= 0.8:
        return 0.7
    return 0.0


# ---------------------------------------------------------------- Canvas

def api(*argv):
    """Run the canvas CLI. Pass path and flags as separate arguments, e.g.
    api('/api/v1/courses/1555698/assignments', '--params', 'per_page=100')."""
    out = subprocess.run([CANVAS, *argv], capture_output=True, text=True)
    try:
        return json.loads(out.stdout.strip())
    except Exception:
        return {"errors": [{"message": f"non-JSON: {out.stdout[:100]} {out.stderr[:100]}"}]}


def fetch_course_data(course_id):
    assignments = api(f"/api/v1/courses/{course_id}/assignments", "--params", "per_page=100")
    if isinstance(assignments, dict):  # error payload
        return None, assignments.get("errors", [{"message": "unknown"}])[0].get("message")
    # Module pages -> plain text, for "mentioned in course materials" evidence
    pages_text = []
    page_sources = []  # (title, text)
    modules = api(f"/api/v1/courses/{course_id}/modules", "--params", "per_page=100")
    if isinstance(modules, list):
        for mod in modules:
            items = api(f"/api/v1/courses/{course_id}/modules/{mod['id']}/items", "--params", "per_page=100")
            if not isinstance(items, list):
                continue
            for it in items:
                if it.get("type") != "Page" or not it.get("url"):
                    continue
                pg = api(it["url"].replace("https://bcourses.berkeley.edu", ""))
                if isinstance(pg, dict) and pg.get("body"):
                    text = re.sub(r"<[^>]+>", " ", pg["body"])
                    text = re.sub(r"\s+", " ", text).strip()
                    pages_text.append(text)
                    page_sources.append((it.get("title", "?"), text))
    course = api(f"/api/v1/courses/{course_id}")
    syllabus = ""
    if isinstance(course, dict) and course.get("syllabus_body"):
        syllabus = re.sub(r"<[^>]+>", " ", course["syllabus_body"])
        syllabus = re.sub(r"\s+", " ", syllabus).strip()
    return {
        "assignments": assignments,
        "pages_text": "\n\n".join(pages_text),
        "page_sources": page_sources,
        "syllabus": syllabus,
    }, None


def page_mention_kind(core, page_sources):
    """Does any course page mention this item as a requirement (due/submit),
    or only casually (e.g. a reading)? Scans all pages; a requirement mention
    anywhere beats a casual mention."""
    toks = [t for t in tokens(core) if len(t) > 3]
    if not toks:
        return None, None
    core_nums = numbers(core)
    best = (None, None)  # (kind, page_title)
    for title, text in page_sources:
        low = text.lower()
        # find a window containing at least 2 distinctive tokens (or 1 if single-token core)
        need = min(2, len(toks))
        for m in re.finditer(r".{0,80}" + r".{0,40}".join(re.escape(t) for t in toks[:3]) + r".{0,80}", low):
            window = m.group(0)
            hits = sum(1 for t in toks if t in window)
            if hits < need:
                continue
            # number-aware: "Concept Check #4" must not match a "Concept Check 2" mention
            if core_nums and not (core_nums & set(re.findall(r"#?(\d+)", window))):
                continue
            kind = "requirement" if DUE_WORDS.search(window) else "casual"
            if kind == "requirement":
                return kind, title  # strongest evidence; stop
            best = (kind, title)
    return best


def canvas_day_pt(due_at):
    if not due_at:
        return None
    dt = datetime.fromisoformat(due_at.replace("Z", "+00:00")).astimezone(PT)
    return dt.strftime("%Y-%m-%d")


CLAIM_PATTERNS = [
    r"Due:\s*([^\n]+)",
    r"Reflection:\s*([^\n]+)",
    r"Pre-class:\s*([^\n]+)",
]


def extract_claims(ev):
    """Pull 'Due: X — date; Y — date' style claims out of a session
    description. Returns [{item, name, date}] with date as YYYY-MM-DD or None."""
    claims = []
    for pat in CLAIM_PATTERNS:
        for m in re.finditer(pat, ev["description"]):
            for item in m.group(1).split(";"):
                item = item.strip(" ;")
                if not item:
                    continue
                name = re.split(r"\s+—\s*", item)[0]
                name = re.sub(r"\bdue\b.*$", "", name, flags=re.I).strip(" ,")
                # strip trailing date/time phrases: "by 6PM Tue 8/4", "Sat 8/1, 11:59PM"
                name = re.sub(r"\bby\b.*$", "", name, flags=re.I).strip(" ,")
                name = re.sub(r"\b(mon|tue|tues|wed|thu|thur|fri|sat|sun)[a-z]*\b.*$",
                              "", name, flags=re.I).strip(" ,")
                name = re.sub(r"\d{1,2}:\d{2}\s*(AM|PM)?.*$", "", name, flags=re.I).strip(" ,")
                name = re.sub(r"\d{1,2}/\d{1,2}.*$", "", name).strip(" ,")
                date_m = re.search(r"(\d{1,2})/(\d{1,2})", item)
                cdate = (f"2026-{int(date_m.group(1)):02d}-{int(date_m.group(2)):02d}"
                         if date_m else None)
                if name:
                    claims.append({"item": item, "name": name, "date": cdate})
    return claims


def verify_claim(name, cdate, assignments, page_sources):
    """Conservative verdict for a description-embedded claim."""
    scored = []
    for a in assignments:
        s = match_score(name, a.get("name", ""))
        ta, tb = set(tokens(name)), set(tokens(a.get("name", "")))
        jacc = len(ta & tb) / len(ta | tb) if (ta | tb) else 0.0
        scored.append((s, jacc, a))
    scored.sort(key=lambda t: (t[0], t[1]), reverse=True)
    s, _, best = scored[0] if scored else (0.0, 0.0, None)
    if best and s >= 0.7:
        cday = canvas_day_pt(best.get("due_at"))
        if cdate and cday and cdate != cday:
            return ("MISMATCH",
                    f"description claims {cdate} but '{best['name']}' is due {cday} in Canvas")
        return ("OK", f"matches '{best['name']}'")
    kind, page = page_mention_kind(name, page_sources)
    if kind == "requirement":
        return ("NOTED", f"no Canvas assignment; required per '{page}'")
    return ("UNVERIFIED", "no Canvas assignment and no requirement in course pages — human check needed")


def loosely_covers(canvas_name, core):
    """Do the assignment and the ICS event core share >=2 distinctive tokens?
    Catches pairs the strict matcher misses, e.g. 'Simulation team + secret
    name' covering 'Sign-up for an Integrated Operations Simulation Team'."""
    ac = {t for t in tokens(canvas_name) if len(t) > 3}
    ec = {t for t in tokens(core) if len(t) > 3}
    return len(ac & ec) >= 2


# ---------------------------------------------------------------- audit

def audit(ics_path, course_id, course_name):
    report = {"course": course_name, "ics": ics_path, "course_id": course_id,
              "events": [], "missing": [], "claims": [], "unverifiable": None}
    if not course_id:
        report["unverifiable"] = "no Canvas course ID (unpublished?) — skipped"
        return report

    data, err = fetch_course_data(course_id)
    if err:
        report["unverifiable"] = f"Canvas API error: {err}"
        return report

    assignments = data["assignments"]
    events = parse_ics(ics_path)
    due_events = [e for e in events if is_due_like(e)]

    matched_assignment_ids = set()

    for ev in due_events:
        core = core_title(ev["summary"])
        # Score every assignment; break ties by Jaccard so a short core like
        # "operations for my job" matches "Part A: Operations for My Job"
        # rather than "Operations for my Job - Week 1 Reflection".
        scored = []
        for a in assignments:
            s = match_score(core, a.get("name", ""))
            ta, tb = set(tokens(core)), set(tokens(a.get("name", "")))
            jacc = len(ta & tb) / len(ta | tb) if (ta | tb) else 0.0
            scored.append((s, jacc, a))
        scored.sort(key=lambda t: (t[0], t[1]), reverse=True)
        best_score, _, best = scored[0] if scored else (0.0, 0.0, None)
        entry = {"uid": ev["uid"], "summary": ev["summary"], "core": core,
                 "ics_day": event_day_pt(ev), "verdict": None, "detail": ""}
        if best and best_score >= 0.7:
            matched_assignment_ids.add(str(best["id"]))
            entry["assignment"] = best["name"]
            entry["assignment_id"] = best["id"]
            problems = []
            cday = canvas_day_pt(best.get("due_at"))
            if cday and entry["ics_day"] and cday != entry["ics_day"]:
                problems.append(f"date differs: ICS {entry['ics_day']} vs Canvas {cday}")
            cp = claimed_points(ev)
            ap = best.get("points_possible")
            if cp is not None and ap is not None and abs(cp - ap) > 0.001:
                problems.append(f"points differ: ICS claims {cp} vs Canvas {ap}")
            if problems:
                entry["verdict"] = "MISMATCH"
                entry["detail"] = "; ".join(problems)
            else:
                entry["verdict"] = "OK"
                entry["detail"] = f"matches '{best['name']}'"
        else:
            kind, page = page_mention_kind(core, data["page_sources"])
            if kind == "requirement":
                entry["verdict"] = "MENTIONED"
                entry["detail"] = f"no Canvas assignment, but required per '{page}' — keep, verify date/points by hand"
                cp = claimed_points(ev)
                if cp is not None:
                    entry["detail"] += f" (ICS claims {cp} pts with no backing assignment)"
            elif kind == "casual":
                entry["verdict"] = "GHOST"
                entry["detail"] = f"no Canvas assignment; only a casual mention in '{page}' (e.g. a reading), not a deliverable"
            else:
                entry["verdict"] = "GHOST"
                entry["detail"] = "no Canvas assignment and no mention in course pages"
        report["events"].append(entry)

    # Reverse check: Canvas assignments with due dates but no ICS event.
    # An assignment counts as covered if it strongly matches a due event
    # (>= 0.7, already recorded above) or loosely matches any due event core
    # (>= 0.5, e.g. a MENTIONED event covering it).
    core_list = [core_title(e["summary"]) for e in due_events]
    for a in assignments:
        if not a.get("due_at") or not a.get("published", True):
            continue
        if str(a["id"]) in matched_assignment_ids:
            continue
        if any(match_score(c, a["name"]) >= 0.5 or loosely_covers(a["name"], c)
               for c in core_list):
            continue
        report["missing"].append({
            "assignment": a["name"], "assignment_id": a["id"],
            "due_pt": canvas_day_pt(a["due_at"]),
            "points": a.get("points_possible"),
            "url": a.get("html_url", ""),
        })

    # Description-embedded claims in session (non-due) events, e.g.
    # "Due: Prepare Uber — Thu 9/24, 6PM" inside a Week 9 session.
    for ev in events:
        if is_due_like(ev):
            continue
        for claim in extract_claims(ev):
            verdict, detail = verify_claim(claim["name"], claim["date"],
                                           assignments, data["page_sources"])
            if verdict != "OK":
                report["claims"].append({
                    "session": ev["summary"], "claim": claim["item"],
                    "name": claim["name"], "verdict": verdict, "detail": detail,
                })

    return report


# ---------------------------------------------------------------- output / prune

def print_report(r):
    print(f"\n{'='*70}\n{r['course']}  (Canvas {r['course_id']})\n{r['ics']}\n{'='*70}")
    if r["unverifiable"]:
        print(f"UNVERIFIABLE: {r['unverifiable']}")
        return
    counts = {}
    for e in r["events"]:
        counts[e["verdict"]] = counts.get(e["verdict"], 0) + 1
        mark = {"OK": "✓", "MISMATCH": "!", "MENTIONED": "~", "GHOST": "✗"}.get(e["verdict"], "?")
        print(f"[{mark} {e['verdict']:9}] {e['summary']}")
        print(f"             {e['detail']}")
    print(f"\nDue events checked: {len(r['events'])} " +
          " ".join(f"{v}={c}" for v, c in sorted(counts.items())))
    if r["missing"]:
        print(f"\nMISSING from ICS ({len(r['missing'])} Canvas assignments with due dates, no ICS event):")
        for m in r["missing"]:
            print(f"  - {m['assignment']}  due {m['due_pt']}  ({m['points']} pts)")
    if r["claims"]:
        print(f"\nDESCRIPTION CLAIMS needing attention ({len(r['claims'])}):")
        for c in r["claims"]:
            mark = {"MISMATCH": "!", "UNVERIFIED": "?", "NOTED": "~"}.get(c["verdict"], "?")
            print(f"[{mark} {c['verdict']:10}] in '{c['session']}'")
            print(f"             claim: {c['claim']}")
            print(f"             {c['detail']}")


def prune_ghosts(ics_path, report):
    ghosts = [e["uid"] for e in report["events"] if e["verdict"] == "GHOST"]
    if not ghosts:
        print("No GHOST events to prune.")
        return 0
    bak = ics_path + ".bak"
    shutil.copy2(ics_path, bak)
    print(f"Backup written to {bak}")
    raw = open(ics_path, encoding="utf-8").read()
    removed = []
    for block in re.findall(r"BEGIN:VEVENT.*?END:VEVENT", raw, re.S):
        m = re.search(r"^UID:(.*)$", block, re.M)
        if m and m.group(1).strip() in ghosts:
            raw = raw.replace(block, "")
            removed.append(m.group(1).strip())
    # tidy leftover blank lines
    raw = re.sub(r"\n{3,}", "\n\n", raw)
    open(ics_path, "w", encoding="utf-8").write(raw)
    print(f"Pruned {len(removed)} GHOST VEVENTs: {', '.join(removed)}")
    return len(removed)


def main():
    args = sys.argv[1:]
    prune = "--prune" in args
    as_json = "--json" in args
    args = [a for a in args if a not in ("--prune", "--json")]

    jobs = []
    if "--all" in args:
        cfg = json.load(open(CONFIG))
        repo = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
        for c in cfg["courses"]:
            jobs.append((os.path.join(repo, c["ics"]), c.get("canvas_id"), c["name"]))
    elif len(args) == 2:
        jobs.append((args[0], args[1], args[0]))
    else:
        print(__doc__)
        sys.exit(1)

    reports = [audit(ics, cid, name) for ics, cid, name in jobs]
    if as_json:
        print(json.dumps(reports, indent=2))
    else:
        for r in reports:
            print_report(r)
    if prune:
        for r in reports:
            if not r["unverifiable"]:
                prune_ghosts(r["ics"], r)


if __name__ == "__main__":
    main()
