---
"@shivaedev/contract": minor
"@shivaedev/react": patch
---

### Added

- `isLiveConnection(atom)` from `@shivaedev/contract/live.ts` tells whether an atom is the `connection` of a `live` subscription, which stays waiting for as long as the subscription runs.

### Fixed

- `screenPending()` settles while a live query is mounted. A live query still keeps the screen pending until its first answer arrives; its open subscription no longer keeps it pending forever.
