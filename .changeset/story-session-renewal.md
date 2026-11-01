---
"@shivaedev/identity": minor
"@shivaedev/create-app": minor
---

### Added

- Identity exposes `signInAgain(auth, userId)` to mint a fresh test session for an existing user using the caller's Effect Clock and Better Auth's configured lifetime.
- Generated apps provide session renewal verbs for HTTP visitors and browser cookies after long story clock jumps.

### Changed

- The starter's app and cookie story kits start TestClock at the present by default so Better Auth's wall-clock endpoints accept minted sessions. Stories can still choose an explicit clock.
