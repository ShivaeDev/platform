---
"@shivaedev/work-fleet": patch
---

### Fixed

- Count worker silence from the live subscription or last activity, whichever is later, so restarts and reconnects give running workers a full stall interval.
- Offer keep waiting for stalled workers, resetting the stall clock without replacing the worker, and close stale stall decisions automatically when the worker resumes activity or completes.
