---
"@shivaedev/identity": minor
"@shivaedev/server": minor
---

### Added

- Identity exposes a socket-scoped session coordinator for hosts to share session rechecks within a batch and drive stream revalidation from one timer.

### Fixed

- Hosted live subscriptions on one socket share hint-time session lookups and periodic session revalidation while retaining per-query read-policy checks and typed revocation failures.
