"""Scrape the official Greek Theatre Berkeley site for concert listings.

Source: https://thegreekberkeley.com/
There is NO official ICS/RSS/API feed. The homepage lists upcoming shows;
each /events/{slug} page carries doors/show times.

Coverage note: the Greek lists CONCERTS ONLY. UC/campus non-concert events
(commencements, speakers, etc.) never appear here — that is a known gap,
recorded in the manifest by the orchestrator.

Update cadence (verified via Wayback Machine analysis of thegreekberkeley.com):
  Jan: ~8 shows listed (early announcements)
  Mar: 17-27 (spring announcement wave)
  May: peak 26-38 (season underway, still adding)
  Summer: steady trickle of additions; past shows drop off
Hence: weekly checks Mar-Oct, monthly Nov-Feb.

All Greek evening concerts are MEDIUM parking impact: crowds fill nearby
lots and add commute traffic around the venue.
"""

import re
import time
from html import unescape

from common import fetch_url, fetch_url_or_none

BASE = "https://thegreekberkeley.com"
GREEK_NOTE = (
    "Greek Theatre evening concert (MEDIUM impact): "
    "crowds fill nearby lots and add commute traffic around the venue."
)

# Homepage anchors: <a ... href=".../events/{slug}" ...> with a title attr like
# "Event Image-Erykah Badu - September 27, 2026 7:00 pm" and a sibling
# <div class="date-show" itemprop="startDate" content="September 27, 2026 7:00pm">
HOMEPAGE_LINK_RE = re.compile(
    r'<a[^>]+href="(?:https://thegreekberkeley\.com)?/events/([a-z0-9-]+)"[^>]*>',
    re.I,
)
TITLE_ATTR_RE = re.compile(r'title="Event Image-(.*?)"', re.I)
DATE_CONTENT_RE = re.compile(
    r'itemprop="startDate"\s+content="([^"]+)"', re.I
)
# Event page: "Doors: 5:30 pm | Show: 7:00 pm"
DOORS_SHOW_RE = re.compile(
    r"Doors:\s*([0-9:]+\s*[ap]m)\s*\|\s*Show:\s*([0-9:]+\s*[ap]m)", re.I
)
PAGE_TITLE_RE = re.compile(r"<title>(.*?)\s*\|\s*Greek Theatre</title>", re.I)
PAGE_DATE_RE = re.compile(
    r"(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),\s+"
    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
    r"(\d{1,2}),\s+(\d{4})",
    re.I,
)

MONTHS = {m: i + 1 for i, m in enumerate(
    "January February March April May June July August September October November December".split()
)}


def _parse_listing_date(text: str):
    """'September 27, 2026 7:00pm' -> (2026, 9, 27, '7:00 pm')."""
    m = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)"
        r"\s+(\d{1,2}),\s+(\d{4})(?:\s+(\d{1,2}:\d{2}\s*[ap]m))?",
        text, re.I,
    )
    if not m:
        return None
    month = MONTHS[m.group(1).capitalize()]
    return (int(m.group(3)), month, int(m.group(2)), (m.group(4) or "").strip() or None)


def scrape_greek_events() -> list[dict]:
    home = fetch_url(BASE + "/")
    slugs = sorted(set(HOMEPAGE_LINK_RE.findall(home)))
    if not slugs:
        raise RuntimeError("no /events/ links found on Greek homepage")

    events: list[dict] = []
    skipped: list[str] = []
    for slug in slugs:
        url = f"{BASE}/events/{slug}"
        try:
            page = fetch_url_or_none(url)
        except Exception as e:  # noqa: BLE001 - connection-level failure aborts
            raise RuntimeError(f"fetch failed for {url}: {e}")
        if page is None:
            skipped.append(slug)  # dead link (past event) — skip, don't fail
            continue
        time.sleep(1)  # be polite: ~1 req/sec

        artist = None
        m = PAGE_TITLE_RE.search(page)
        if m:
            artist = unescape(m.group(1)).strip()

        date_parts = None
        m = DATE_CONTENT_RE.search(page) or re.search(
            r'itemprop="startDate"\s+content="([^"]+)"', home[max(0, home.find(slug) - 2000):home.find(slug) + 500], re.I
        )
        if m:
            date_parts = _parse_listing_date(unescape(m.group(1)))
        if not date_parts:
            m = PAGE_DATE_RE.search(page)
            if m:
                date_parts = (int(m.group(4)), MONTHS[m.group(2).capitalize()], int(m.group(3)), None)
        if not date_parts:
            # last resort: homepage title attr near the slug link
            i = home.find(slug)
            seg = home[max(0, i - 1500):i + 500]
            m = TITLE_ATTR_RE.search(seg)
            if m:
                date_parts = _parse_listing_date(unescape(m.group(1)))
                if not artist:
                    artist = unescape(m.group(1)).split(" - ")[0].strip()
        if not date_parts or not artist:
            raise RuntimeError(f"could not parse event page: {url}")

        year, month, day, show_time = date_parts
        doors = show = None
        m = DOORS_SHOW_RE.search(page)
        if m:
            doors, show = m.group(1).strip(), m.group(2).strip()
        show = show or show_time

        events.append({
            "uid": f"greek-{slug}",
            "year": year, "month": month, "day": day,
            "title": f"Greek Theatre: {artist}",
            "artist": artist,
            "url": url,
            "show_time": show,
            "doors_time": doors,
            "severity": "medium",
            "note": GREEK_NOTE,
        })

    events.sort(key=lambda e: (e["year"], e["month"], e["day"]))
    if skipped:
        print(f"skipped {len(skipped)} dead link(s): {', '.join(skipped)}", flush=True)
    return events


if __name__ == "__main__":
    evs = scrape_greek_events()
    print(f"{len(evs)} Greek events")
    for e in evs:
        print(f"{e['year']}-{e['month']:02d}-{e['day']:02d} | {e['artist']} | doors {e['doors_time']} show {e['show_time']}")
