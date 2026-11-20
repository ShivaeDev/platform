---
"@shivaedev/server": minor
---

### Added

- `@shivaedev/server`: `workerHost` masks its logs, the causes its installed error reporters receive and its exported spans with the application host's policy: the built-in credential-shaped name rules, `config.sensitiveKeys`, and the names of fields that the models of the repositories it builds mark sensitive (`sensitive: true` or a Redacted schema). Its `config` takes `sensitiveKeys` beside the database settings, typed as the new `WorkerHostConfig`. A worker serves no RPC group, so no RPC schema adds names.

### Breaking

- `@shivaedev/server`: `workerHost` exports traces through `otlpTracing` itself, as `appHost` does, so the export masks the worker's whole policy, and its Layer's error type now includes `SensitiveFieldConflict` and `InvalidRedactionMask`. Remove `Layer.provide(otlpTracing)` from around `workerHost`; keeping it builds a second exporter and diagnostics pipeline around the worker.
