---
"@shivaedev/work-board": patch
"@shivaedev/work-fleet": patch
---

### Fixed

- End Board subscriptions at shutdown and bound request draining so open browser tabs cannot hold a restart.
- Force-kill supervised children that exceed the stop deadline and keep supervising their siblings during restarts.
