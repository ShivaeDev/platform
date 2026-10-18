---
"@shivaedev/work-fleet": patch
---

### Fixed

- Start the daemon listener after its handlers are ready so reconnecting watches cannot enter an unhandled request during startup.
- End active daemon follow subscriptions before shutting down HTTP so watches reconnect after a restart without waiting on open streams.
