### Fixed

- A missing browser bundle logs its build command once when the Board starts and returns the same message in the bundle's HTTP 500 response. Building the bundle restores serving without restarting the Board.

### Added

- `checkNativeAsset()` in `http/assets.ts` checks bundle availability and logs the missing-bundle warning through Effect.
