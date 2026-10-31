---
"@shivaedev/work-board": patch
---

### Fixed

- The board scans the workspace only after its watcher reports a short-lived `.work-board-watch-*` file the board writes into the workspace root and removes again, instead of after a fixed 100 ms pause, so an edit made while a slow watch registers is no longer missed. A watcher that reports nothing within 5 seconds fails the watch as unavailable; the board then reads files fresh on each request and retries the watch.
