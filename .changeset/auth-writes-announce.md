---
"@shivaedev/identity": patch
---

### Fixed

- Sign-ups, profile changes, sign-ins and sign-outs made through a Better Auth mount now announce identity's `userKeys` and `sessionKeys`, so open users and sessions lists refresh without a reload. A mount created inside `transact` announces on that transaction's commit and a rollback announces nothing; a startup mount announces right after Better Auth's own commit. Applications need no hooks of their own, and their own Better Auth hooks keep running.
- `sweepExpiredSessions` announces `sessionKeys.list` when it removes expired sessions.
