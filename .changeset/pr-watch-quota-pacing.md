---
"@shivaedev/pr-watch": patch
---

### Fixed

- Pace PR polling only when remaining GitHub quota cannot sustain the observed request demand until reset. Ignore expired observations and name the limiting budget, remaining count, limit and reset time in quota pacing cooldowns.
