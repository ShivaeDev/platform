---
"@shivaedev/platform": minor
---

### Added

- `@shivaedev/platform/better-auth.ts` exposes `betterAuthMount(options)`, returning a typed Better Auth instance and native `/api/auth/*` route Layer with a 503 fallback, trusted-peer forwarded-IP handling and Config-controlled rate limiting. Applications supply their Better Auth options and RPC session policy.
- `authDatabase(url)` scopes the Better Auth PostgreSQL pool, logs idle-client errors at Debug and waits for clients to disconnect on release. The entry uses the existing Better Auth integration and the optional `pg` peer.
