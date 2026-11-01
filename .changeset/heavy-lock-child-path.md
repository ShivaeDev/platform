---
"@shivaedev/heavy-lock": patch
---

### Fixed

- Pass the selected lock path in the held environment so child processes join the same lock when an explicit `lockPath` overrides their environment.
