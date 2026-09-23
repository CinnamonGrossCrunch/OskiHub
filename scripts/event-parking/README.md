# Event-parking automation

Weekly/monthly refresh of the parking-impact event data that feeds the
calendar's parking badges and day-of banner.

## Sources

| Source | Fetch | Filter / classify |
|---|---|---|
| Cal Athletics | `https://calbears.com/calendar.ics` (official composite feed) | Keep **home Berkeley events only** (drop away + neutral-site games). **Haas Pavilion events excluded entirely** (across campus, no parking impact). Severity by venue: football @ Memorial Stadium = HIGH; other Berkeley venues = LOW (icon only, no badge). |
| Greek Theatre | Scrape `https://thegreekberkeley.com/` homepage + `/events/{slug}` pages (no official feed exists) | Concerts only — **HIGH**. UC non-concert events are never listed here (known gap). |
| UC campus non-concert | `fetch_campus.py` (stub) | No verified machine-readable source (events.berkeley.edu is LiveWhale; the Localist `/api/2/events` endpoint 404s). Gap documented in manifest. |

## Update cadence (verified via Wayback analysis of thegreekberkeley.com)

- Jan: ~8 shows · Mar: 17–27 (spring announcement wave) · May: peak 26–38 ·
  Summer: steady trickle, past shows drop off.
- **Weekly March–October**, **monthly November–February** (two cron jobs).

## Running

```bash
cd ~/workspace/oskihub/repo
python3 scripts/event-parking/update_parking_events.py [--force]
```

Outputs (committed):
- `public/parking-events/cal_bears_home.ics`
- `public/parking-events/greek_theater.ics`
- `public/parking-events/manifest.json`
- `lib/generated/greekTheaterEvents.ts` (typed module consumed by `lib/greekTheater.ts`)

Severity travels in the ICS as `X-PARKING-SEVERITY: HIGH|MEDIUM|LOW` plus
`X-PARKING-NOTE` with the human-readable closure/crowd description.

## Safety

- Writes are atomic (temp + fsync + rename); readers never see half-written files.
- On any fetch or validation failure, the last-known-good files are preserved —
  the updater never ships an empty or corrupt feed.
- Validation: balanced VEVENT blocks, minimum event counts, non-empty scrape.
- UI rule: only HIGH severity events trigger the parking badge and
  day-of banner. LOW events (e.g. Edwards Stadium track meets) show the bear
  icon but no parking warning — a basketball game across campus doesn't affect
  Haas parking.
