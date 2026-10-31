---
"@shivaedev/identity": minor
---

### Added

- Read a user's stored sessions with `authTestDatabase.sessionsFor(userId)`, including native Effect expiry timestamps and clock-relative expiry state. Revoked and swept sessions disappear from the readout.

### Fixed

- Use Effect's clock for session administration expiry filters and expired-session sweeps. Better Auth session providers also reject sessions whose returned `session.expiresAt` has passed, so stories can advance `TestClock` without rewriting stored timestamps.
