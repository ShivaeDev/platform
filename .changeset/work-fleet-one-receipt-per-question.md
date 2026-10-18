---
"@shivaedev/work-fleet": patch
---

### Fixed

- A retry answer on a Board context changed decision now records a single applied receipt instead of also queueing a superseded one, and Fleet refuses to write a second receipt for a question that already has one.
