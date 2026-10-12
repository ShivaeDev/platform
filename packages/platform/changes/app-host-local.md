### Added

- `appHost` accepts `rpcPath` to choose the NDJSON RPC route; it still defaults to `/rpc`.
- `appHost` accepts `sessions: "loopback"` for local RPC without a session provider. The transport still requires a loopback peer and Host, matching or absent Origin, and NDJSON content type; proxy trust does not apply to this policy.
- `appHost` can omit `migrations` to start without a PostgreSQL pool or database configuration. `AppHttpHostOptions` describes this form while `AppHostOptions` retains its required migrations. Applications can provide an `appDatabase` layer through `services`; existing callers that supply migrations keep the migrated database composition.
- `appDatabase` and the migrated `appHost` accept `config.maxConnections` to bound the PostgreSQL pool.
- `appHost` forwards `config.disablePreemptiveShutdown` to the native Node host so a scoped daemon can interrupt its RPC streams during shutdown. The native default remains unchanged when omitted.
