---
"@shivaedev/work-board": patch
---

### Added

- Search results carry a `match` field: `exact`, `prefix`, `title` or `text`.

### Changed

- In the search palette, a row whose title or ID matches the query exactly, or starts with a query of two or more words, comes first whatever its group, including plain documents. The other groups follow their best match. An empty query keeps the fixed group order with Needs you first.
- Exact and starts-with matches rank ahead of the 40-result limit, so many work items that only mention the words can no longer push them out.
- Search results and the Library show the kind `project` as Goal, and show every kind in sentence case.
