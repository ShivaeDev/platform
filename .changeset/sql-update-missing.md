---
"@shivaedev/effect-sql": minor
---

### Added

- Unversioned repositories accept `update(input, { onMissing: "fail" })` to return a typed `NoSuchElementError` when no row matches a single-column or composite key. Updates still decode the returned row and announce changes only after commit; missing rows announce nothing. Calls without the option retain their missing-row defect, and versioned repositories retain their typed optimistic concurrency failures.
