---
"@shivaedev/react": minor
"@shivaedev/test-story": minor
---

### Added

- `@shivaedev/react`: Provides `useDebouncedValue` and cancellable `useDelay` hooks on the atom runtime's Effect Clock. Pending timers count as observed atom work for screen settlement and cancel on unmount.
- `@shivaedev/test-story`: Screen drivers accept a watched `clock` to advance registered sleeps inside the renderer's `act` while waiting for completion. Debounced searches settle without real waits or a duration in the kit verb.
