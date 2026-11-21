---
"@shivaedev/quality": patch
---

### Fixed

- The `ambient-runtime` Biome plugin finds bare browser I/O globals by matching identifier expressions instead of every syntax node, so a Biome run with Quality's preset takes about as long as it did before the browser I/O ban: on the starter app, 0.7 s instead of 2.5 s. It reports the same findings.
