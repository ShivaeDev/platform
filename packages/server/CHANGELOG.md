# Changelog

## 0.2.0 - 2026-10-27

### Added

- Session hosts bound to a non-loopback address without proxy trust warn at startup to configure `TRUSTED_PROXY` or `config.trustedProxy` before forwarding RPC requests.

### Fixed

- Development auth accepts both `localhost` and `127.0.0.1` over HTTP on any port when `PUBLIC_URL` is unset. Explicit `baseURL` and `trustedOrigins` options replace those defaults.
- Auth rate limiting uses the connection peer address without a trusted proxy, separating client buckets and avoiding Better Auth's missing-client-IP warning. Trusted forwarding still takes precedence, and untrusted forwarding headers are ignored.
- Supply the host's body-size limit to application routes, so bounded body readers enforce the same limit as RPC.

## 0.1.0 - 2026-10-27

### Added

- First release of `@shivaedev/server`, the application host extracted from `@shivaedev/platform`: `appHost`, the database layer and migrations, health, OTLP export, the redacting tracer and RPC serialization, development mode, the Promise runtime (`runtime/`) and Node subscription signals (`node-http/`). Modules sit at the package root, so `@shivaedev/platform/server/appHost.ts` becomes `@shivaedev/server/appHost.ts`. The `AppChanges` and `RedactionPolicy` service ids now name the package.
