---
"@shivaedev/server": minor
---

### Fixed

- In the deferred `application` form, the names an application lists in `config.sensitiveKeys` are masked from the first line the `application` Effect logs, and in the host's preflight logs, so a service that logs such a value while it is built no longer writes it in clear.

### Breaking

- In the deferred `application` form, move `sensitiveKeys` from the `config` the `application` Effect returns to `appHost`'s own `config`, beside `databaseUrl`: `appHost({ config: { databaseUrl, sensitiveKeys: ["customerReference"] }, application })`. The options the Effect returns no longer accept `config.sensitiveKeys`.
- Code that composes the host below `appHost` passes the configured names to `deferredHost` as a third argument, `deferredHost(application, database, { config: { sensitiveKeys } })`. The policy `hostSensitiveKeys` returns replaces `configure` with `serve`, which takes only the RPC group: the configured names stay those `hostSensitiveKeys` received.
