# Changelog

## 0.2.0 - 2026-10-27

### Added

- Session hosts bound to a non-loopback address without proxy trust warn at startup to configure `TRUSTED_PROXY` or `config.trustedProxy` before forwarding RPC requests.

### Fixed

- Development auth accepts both `localhost` and `127.0.0.1` over HTTP on any port when `PUBLIC_URL` is unset. Explicit `baseURL` and `trustedOrigins` options replace those defaults.
- Auth rate limiting uses the connection peer address without a trusted proxy, separating client buckets and avoiding Better Auth's missing-client-IP warning. Trusted forwarding still takes precedence, and untrusted forwarding headers are ignored.

## 0.1.0 - 2026-10-27

### Added

- First release of `@shivaedev/identity`: request identity and the RPC middleware declarations (`identity.ts`, `middleware.ts`, `permission.ts`), session resolution, Origin policy, trusted proxies, permission enforcement and request tracing (`server/`), and the Better Auth mount, sign-in policy and test helpers (`server/better-auth/`). The service and middleware ids now name the package (`@shivaedev/identity/Identity`, `@shivaedev/identity/Authenticated` and so on).
