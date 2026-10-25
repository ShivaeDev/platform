---
"@shivaedev/work-fleet": patch
---

### Changed

- Fleet logs dependency, area and back-pressure waits once per changed reason at info without a stack trace, while unexpected dispatch failures retain warnings with their cause.
