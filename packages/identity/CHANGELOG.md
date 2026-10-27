# Changelog

## 0.1.0 - 2026-10-27

### Added

- First release of `@shivaedev/identity`: request identity and the RPC middleware declarations (`identity.ts`, `middleware.ts`, `permission.ts`), session resolution, Origin policy, trusted proxies, permission enforcement and request tracing (`server/`), and the Better Auth mount, sign-in policy and test helpers (`server/better-auth/`). The service and middleware ids now name the package (`@shivaedev/identity/Identity`, `@shivaedev/identity/Authenticated` and so on).
