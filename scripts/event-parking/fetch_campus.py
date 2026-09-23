"""UC non-concert campus events (commencements, speakers, etc.) — best effort.

Status: NOT IMPLEMENTED as a live source.

- events.berkeley.edu runs LiveWhale Calendar, not Localist; the standard
  Localist /api/2/events endpoint 404s (verified 2026-09-23).
- LiveWhale's JSON endpoints were probed and are not trivially discoverable.
- The Greek Theatre lists concerts only, so UC non-concert events remain a
  known coverage gap.

This module keeps the gap explicit: it returns no events and a note that the
orchestrator records in the manifest. When a reliable machine-readable
campus-events source is identified, implement fetch_campus_events() here.
"""

COVERAGE_NOTE = (
    "UC non-concert campus events (commencements, speakers, large campus "
    "gatherings) are NOT covered: the Greek Theatre lists concerts only, "
    "and events.berkeley.edu (LiveWhale) exposes no verified machine-readable "
    "feed. Coverage gap — revisit if a stable source is found."
)


def fetch_campus_events() -> tuple[list[dict], str]:
    """Returns ([], coverage note). Kept as a stub until a source is verified."""
    return [], COVERAGE_NOTE
