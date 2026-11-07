---
"@shivaedev/quality": patch
---

### Fixed

- Accept recharts imports in `client/` folders for shadcn charts while continuing to report them in server modules. Prefer shadcn's Chart component (`ChartContainer` and friends) over raw recharts primitives where it covers the case.
