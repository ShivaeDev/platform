### Added

- `readRetryMs` in Fleet policy and `fleet.config.json` sets the first provider and integration read-retry delay, defaulting to 30 seconds; later retries still double it. The daemon applies an edited value without a restart.

### Breaking

- `readHostConfig` and `loadHost` moved from `@shivaedev/work-fleet/host/config.ts` to `@shivaedev/work-fleet/host/configFile.ts`.
