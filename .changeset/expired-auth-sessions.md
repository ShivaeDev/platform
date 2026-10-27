---
"@shivaedev/identity": minor
"@shivaedev/create-app": minor
---

### Added

- Identity exports `sweepExpiredSessions`, an Effect over the application's SQL client that deletes expired Better Auth sessions and returns the number removed without mounting auth.
- The starter worker sweeps expired auth sessions daily at midnight UTC. New apps and apps using the starter updater receive the schedule.
- `authTestDatabase(pool).expireSessions(userId)` expires only the selected user's sessions; omit the user id to expire every session.

### Breaking

- Call `authTestDatabase(pool).expireSessions()` instead of yielding the `expireSessions` property directly.
