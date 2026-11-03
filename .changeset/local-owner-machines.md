---
"@shivaedev/identity": minor
---

### Added

- Add `localOwner` for loopback applications to hand a process-local owner credential to their own client and resolve the owner through the existing session, viewer and permission middleware.
- Add PostgreSQL-backed scoped machine credentials with `machineTokenMigration` and `machineTokens`. Application access roles grant each scope's permissions; live lookups refuse revoked credentials on the next request and during open live-query revalidation. HTTP bearer and WebSocket first-frame authentication use the existing transports.
