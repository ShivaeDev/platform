---
"@shivaedev/work-fleet": minor
"@shivaedev/work-board": minor
"@shivaedev/platform": minor
---

### Added

- Run Fleet and Work Board together with `work-fleet up <board-dir>`, with exclusive board ownership, process and code-change restarts, combined logs, `up --status` and clean shutdown through `down`.
- Work Board coordinates command-line process ownership with Fleet supervision and refuses a hand-started server while `up` holds its directory.
- The HTTP host accepts Effect’s native `gracefulShutdownTimeout` so supervised processes can finish active requests before restarting.
