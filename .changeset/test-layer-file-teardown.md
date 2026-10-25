---
"@shivaedev/effect-test": patch
---

### Fixed

- Close shared test service Layers before their test file completes so database cleanup finishes before Vitest starts terminating the fork.
