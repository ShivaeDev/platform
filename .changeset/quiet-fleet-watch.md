---
"@shivaedev/work-fleet": minor
---

### Changed

- Bare `work-fleet watch` follows actionable Fleet transitions, Board answers and PR queue and health events without quiet heartbeats. It prints one text event per line; use `--json` for JSON lines and `--events released` to include releases.
