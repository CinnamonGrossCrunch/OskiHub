# bCourses Change Watcher

Polls the bCourses (Canvas) API for Matt's Fall 2026 courses and reports
what changed — new assignments, moved due dates, newly published items,
new lecture files, new announcements.

## How it works

`watch.py` fetches assignments, modules, files, and announcements for each
watched course, then diffs against a local JSON snapshot. Nothing changed →
prints `NO CHANGES` and exits. This keeps LLM/token spend at ~zero on quiet
days: only a real diff ever reaches an agent.

The snapshot lives outside the repo (it's runtime state, not source):

```
~/workspace/goals/oskihub-fall-2026-refresh/hidden_files/bcourses-watch/snapshot.json
```

First run establishes the baseline and alerts on nothing.

## Watched courses

- `1555698` — EW204 Operations
- `1555570` — EW200C Leadership Communication

EW209 Strategic Leadership is unpublished (no Canvas course to poll); add its
ID here when the instructor publishes it.

## Schedule

A cron job (`bcourses-change-watch`) runs this every 8 hours. On a diff, the
run updates the matching OskiHub ICS file(s), commits, and notifies Matt.

## Manual run

```bash
python3 scripts/bcourses-watch/watch.py
python3 scripts/bcourses-watch/watch.py --snapshot /tmp/snap.json
```

Auth: uses the `custom.bcourses` credential via
`~/workspace/skills/bcourses/bin/canvas` (read-only). Never handles raw keys.
