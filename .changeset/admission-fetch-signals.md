---
"@shivaedev/work-fleet": patch
---

### Changed

- Trace main-read attempts with `GitMainSource.latest` and serialized fetches with `GitMainSource.fetch` so contention can be observed separately from fetch execution.
