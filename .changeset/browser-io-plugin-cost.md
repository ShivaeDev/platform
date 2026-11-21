---
"@shivaedev/quality": patch
---

### Fixed

- The `ambient-runtime` Biome plugin finds bare browser I/O globals by matching identifier expressions instead of every syntax node. A Biome run with Quality's preset over the starter app takes 0.8 s instead of 2.7 s (0.5 s before the browser I/O ban), and the plugin reports the same findings.
