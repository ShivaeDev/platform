---
"@shivaedev/create-app": patch
"@shivaedev/jobs": minor
"@shivaedev/server": minor
"@shivaedev/sql": minor
---

### Added

- `@shivaedev/jobs`: Testing controllers accept a native Effect TestClock and expose `timePasses` to advance PostgreSQL job time, wake due RetryAt jobs and wait for their settlement.
- `@shivaedev/server`: The `hostTime` testing layer advances worker lease time and waits for heartbeat and release checks.
- `@shivaedev/sql`: Add the scoped `WorkerReleaseTesting` hook for host stories to control lease time and await release checks.

### Fixed

- `@shivaedev/create-app`: Generated starter worker stories pass lease time through the host verb instead of fixed sleeps.
- `@shivaedev/server`: Worker-release heartbeat and polling timers use the live lifecycle clock by default, so passing an application day does not replay every heartbeat.

### Breaking

- `@shivaedev/server`: Stories that drive worker-release polling through their application TestClock must now pass that clock as `config.clock` to `appDatabase`, `appHost` or `workerHost`. Use the `hostTime` testing layer and its `timePasses` verb to advance lease timestamps and await release checks.
