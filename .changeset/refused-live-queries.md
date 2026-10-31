---
"@shivaedev/contract": minor
"@shivaedev/react": minor
---

### Added

- React query hooks, including `useLoaderQuery` and loader-backed editor queries, expose `denied` for a `QueryReadDenied` refusal so screens can replace retained data.

### Fixed

- Live queries refused with `QueryReadDenied` remain refused through matching invalidations and resume events until their input or viewer changes. They stop automatic subscription attempts and refused reads.
- `queryRoute` sends read denials to the route's not-found component, just like missing records.

### Changed

- A `$changes` batch remains all-or-nothing: one denied query rejects or ends live updates for the whole batch. Split queries with independent permissions into separate `$changes` requests; automatic bound queries already subscribe separately.
