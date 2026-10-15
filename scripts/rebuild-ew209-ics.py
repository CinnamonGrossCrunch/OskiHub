#!/usr/bin/env python3
"""Regenerate EW209 Blue/Gold ICS from syllabus + Canvas truth.

Syllabus source: EWMBA_209_Syllabus_Fall_2026.docx (bCourses file 95669979).
Key syllabus rules encoded here:
- 01B meets Wednesdays, 02B meets Thursdays, 6:00-9:30pm, N470 Chou Hall,
  dinner break 7:30-8:15pm.
- Pre-class questions due 5:30pm on YOUR SECTION'S class day.
- Assignment 1 due 5:30pm on section's Week 2 class day: Oct 21 (01B), Oct 22 (02B).
- Week 5: Thursday 11/12 only (no Wed 11/11 class - Veterans Day).
- Week 7: no class meeting (take-home exam); exam slot sign-up by Mon Nov 23.
"""
from datetime import datetime
from zoneinfo import ZoneInfo

PT = ZoneInfo("America/Los_Angeles")
NOW = datetime.now(PT)
DTSTAMP = NOW.strftime("%Y%m%dT%H%M%SZ")

COURSE_ID = 1557494

# (week, blue_date, gold_date, topic, case)
WEEKS = [
    (1, "20261014", "20261015", "Introduction to Strategy and Industry Analysis", "Cola Wars"),
    (2, "20261021", "20261022", "Value Creation, Capture and Irreplaceability", "Intel"),
    (3, "20261028", "20261029", "Competitive Advantage and Positioning", "Tesla"),
    (4, "20261104", "20261105", "Entry and Dynamics", "RyanAir"),
    (5, None,       "20261112", "Innovation", "Guest speaker"),
    (6, "20261118", "20261119", "Strategic Interactions", "Bitter Competition"),
    (7, None,       None,       "Take-Home Exam (no class meeting)", None),
    (8, "20261202", "20261203", "Boundaries of the Firm", "Disney"),
    (9, "20261209", "20261210", "Growth and Change", None),
]

# (canvas_id, canvas_name, points, blue_dtstart, gold_dtstart, note)
DUE = [
    (9157439, "Week 1: Case Question", 1,
     "20261014T173000", "20261015T173000", ""),
    (9158014, "Assignment 1: Industry Structure and Market Expectations", 15,
     "20261021T173000", "20261022T173000",
     "Per syllabus: due 5:30 p.m. on your section's Week 2 class day (Oct 21 for 01B, Oct 22 for 02B)."),
    (9157442, "Week 2: Case Question", 1,
     "20261021T173000", "20261022T173000", ""),
    (9157443, "Week 3: Case Question", 1,
     "20261028T173000", "20261029T173000", ""),
    (9158007, "Week 4: Case Question", 1,
     "20261104T173000", "20261105T173000", ""),
    (9158011, "Week 5: Article Question", 1,
     "20261112T173000", "20261112T173000",
     "No 01B class this week (Wed 11/11 is Veterans Day); Canvas due date Thu 11/12 5:30 p.m. applies to both sections."),
    (9158008, "Week 6: Case Question", 1,
     "20261118T173000", "20261119T173000", ""),
    (9158009, "Week 8: Case Question", 1,
     "20261202T173000", "20261203T173000", ""),
    (9158012, "Week 7: Article Question", 1,
     "20261209T173000", "20261210T173000", ""),
]

DAY_NAME = {"blue": "Wednesday", "gold": "Thursday"}


def esc(s):
    return s.replace("\\", "\\\\").replace("\n", "\\n").replace(",", "\\,").replace(";", "\\;")


def session_vevent(n, total, date, week, topic, case, cohort):
    day = DAY_NAME[cohort]
    code = "EW209.1B" if cohort == "blue" else "EW209.2B"
    desc_lines = [
        f"Course: {code} Strategic Leadership (2 units)",
        f"Instructor: Slattery, C.",
        f"Week {week}: {topic}.",
    ]
    if case:
        desc_lines.append(f"Case: {case} (via study.net).")
    desc_lines.append("Pre-class question due 5:30 PM via bCourses (on your section's class day).")
    desc_lines.append("Dinner break 7:30-8:15 PM.")
    return "\n".join([
        "BEGIN:VEVENT",
        f"UID:ew209-{date}@oski.app",
        f"DTSTAMP:{DTSTAMP}",
        f"DTSTART:{date}T180000",
        f"DTEND:{date}T213000",
        f"SUMMARY:Strategic Leadership ({code}) \u2014 Session {n} of {total}",
        f"DESCRIPTION:{esc(chr(10).join(desc_lines))}",
        "LOCATION:Chou Hall N470",
        "END:VEVENT",
    ])


def due_vevent(cid, name, points, dtstart, cohort):
    code = "EW209.1B" if cohort == "blue" else "EW209.2B"
    extra = ""
    if cohort == "gold":
        # find the syllabus note for this assignment
        for (aid, _, _, _, _, note) in DUE:
            if aid == cid and note:
                extra = f"\\n{esc(note)}"
                break
        else:
            extra = "\\nPer syllabus: pre-class questions due 5:30 p.m. on your section's class day (Thursday for 02B). Canvas lists the Wednesday section date."
    else:
        for (aid, _, _, _, _, note) in DUE:
            if aid == cid and note and "Veterans Day" in note:
                extra = f"\\n{esc(note)}"
                break
    pts = f"{points:g}"
    return "\n".join([
        "BEGIN:VEVENT",
        f"UID:ew209-due-{cid}@oski.app",
        f"DTSTAMP:{DTSTAMP}",
        f"DTSTART:{dtstart}",
        f"SUMMARY:Strategic Leadership \u2014 {esc(name)} due",
        f"DESCRIPTION:EW209 Strategic Leadership ({pts} pt{'s' if points != 1 else ''}). Due 5:30 PM {DAY_NAME[cohort]}.\\nAssignment: {esc(name)}{extra}",
        f"URL:https://bcourses.berkeley.edu/courses/{COURSE_ID}/assignments/{cid}",
        "END:VEVENT",
    ])


def exam_vevent(cohort):
    return "\n".join([
        "BEGIN:VEVENT",
        f"UID:ew209-exam-signup-{cohort}@oski.app",
        f"DTSTAMP:{DTSTAMP}",
        "DTSTART;VALUE=DATE:20261123",
        "SUMMARY:Strategic Leadership \u2014 Take-home exam slot sign-up",
        "DESCRIPTION:Per syllabus: sign up for a take-home exam slot by Monday\\, November 23 (or you will be assigned a default slot). Week 7 has no class meeting; the exam is offered during predetermined windows decided as a class.",
        "END:VEVENT",
    ])


def build(cohort):
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//OskiHub//EWMBA Fall 2026//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:EW209 Strategic Leadership ({cohort.capitalize()} cohort, Fall 2026)",
        "X-WR-TIMEZONE:America/Los_Angeles",
    ]
    sessions = [(w, d) for (w, db, dg, t, c) in WEEKS
                for d in [db if cohort == "blue" else dg] if d]
    total = len(sessions)
    for n, (week, date) in enumerate(sessions, 1):
        topic = next(t for (w, _, _, t, _) in WEEKS if w == week)
        case = next(c for (w, _, _, _, c) in WEEKS if w == week)
        lines.append(session_vevent(n, total, date, week, topic, case, cohort))
    for (cid, name, points, b_dt, g_dt, _note) in DUE:
        lines.append(due_vevent(cid, name, points, b_dt if cohort == "blue" else g_dt, cohort))
    lines.append(exam_vevent(cohort))
    lines.append("END:VCALENDAR")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    import sys
    out = sys.argv[1]
    cohort = sys.argv[2]
    open(out, "w").write(build(cohort))
    n = build(cohort).count("BEGIN:VEVENT")
    print(f"wrote {out}: {n} events")
