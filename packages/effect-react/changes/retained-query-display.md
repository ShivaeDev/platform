### Added

- Add opt-in `useQuery(atom, { keepPreviousData: true })` to retain the last successful value while a changed query payload loads or fails. Query identity changes still reset displayed data by default, and registry changes clear it even with retention enabled. Native results, typed failures and interruption remain visible.

### Fixed

- Keep the last successful query value during same-identity refreshes, including live invalidation, and after failed refreshes even when the native result has no retained success. `refreshing` reports pending work alongside displayed data.
