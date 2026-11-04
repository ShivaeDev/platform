---
"@shivaedev/script": minor
---

### Added

- Add `defineScript({ args, run })` as a Node entry point with inferred native Effect CLI arguments, environment Config, logging and Node services. Script scopes close on success, failure and Ctrl-C; ordinary typed failures exit with code 1 and interruptions with code 130.
