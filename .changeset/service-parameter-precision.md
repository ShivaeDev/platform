---
"@shivaedev/quality": patch
---

### Fixed

- Recognize service implementation parameters by their declared service shape instead of incidental assignability to a discovered service. Ordinary atoms, schemas, records and tuples no longer count as services; service tags, class instances, implementation shapes and non-empty Contexts remain checked.
