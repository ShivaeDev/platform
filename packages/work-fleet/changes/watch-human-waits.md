### Fixed

- `work-fleet watch --follow` reports current needs-human waits from its first snapshot, including a review that finishes while the watch connects, and reports readiness again after repair. Unchanged waits stay quiet across daemon reconnects.
