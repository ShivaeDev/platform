### Added

- `AppHostOptions.config.host` / `HOST` and `config.trustedProxy` / `TRUSTED_PROXY` allow a non-loopback listener and same-origin HTTP/NDJSON RPC through an exact trusted proxy peer. `localRpcGuard(effect, trustedProxy?)` accepts the same proxy address; loopback defaults and typed RPC refusals are preserved.
