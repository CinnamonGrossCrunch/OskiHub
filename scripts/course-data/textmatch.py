"""Shared fuzzy title matching for the course-data pipeline.

Number-aware: 'Concept Check #4' never matches 'Concept Check #3'.
(Deliberately duplicated from scripts/audit-course-ics.py, which stays
standalone so the audit gate doesn't depend on pipeline code.)
"""
import re

STOPWORDS = {
    "operations", "leadership", "communication", "communications", "strategy",
    "strategic", "due", "the", "a", "an", "for", "my", "of", "and", "to",
    "ew204", "ew200c", "ew209", "1a", "1b", "2a",
}


def normalize(s):
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9# ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def tokens(s):
    return [t for t in normalize(s).split() if t not in STOPWORDS and len(t) > 1]


def numbers(s):
    return set(re.findall(r"#?(\d+)", normalize(s)))


def core_title(summary):
    """Strip 'Course — ' prefix and trailing 'due' -> comparable core."""
    s = re.sub(r"^.*?—\s*", "", summary or "")
    s = re.sub(r"\bdue\b\.?\s*$", "", s, flags=re.I).strip()
    return s


def match_score(ics_core, canvas_name):
    a, b = normalize(ics_core), normalize(canvas_name)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if a in b or b in a:
        return 0.9
    na, nb = numbers(ics_core), numbers(canvas_name)
    if na and nb and na != nb:
        return 0.0
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


def jaccard(a, b):
    ta, tb = set(tokens(a)), set(tokens(b))
    return len(ta & tb) / len(ta | tb) if (ta | tb) else 0.0


def best_match(core, candidates, key=lambda c: c):
    """Return (score, candidate) with Jaccard tie-breaking."""
    scored = [(match_score(core, key(c)), jaccard(core, key(c)), c)
              for c in candidates]
    scored.sort(key=lambda t: (t[0], t[1]), reverse=True)
    return (scored[0][0], scored[0][2]) if scored else (0.0, None)
