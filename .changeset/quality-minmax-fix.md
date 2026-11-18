---
"@shivaedev/quality": patch
---

### Fixed

- `quality fix` no longer rewrites a ternary that picks the larger or smaller of two values into `Math.max` or `Math.min`. Biome's unsafe fix also rewrote `a.at < b.at ? b.at : a.at` when `at` is a `Date` field, which left code that no longer typechecks. `complexity/useMathMinMax` still reports the ternary; write `Math.max` for numbers by hand, and compare `getTime()` for dates.
