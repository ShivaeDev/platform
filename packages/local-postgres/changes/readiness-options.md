### Added

- `localPostgres(environment, { attempts, delayMillis })` sets how many readiness checks `startPostgres` makes after it starts the container and how long it waits between them. The defaults stay at 30 checks one second apart.
