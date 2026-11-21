---
"@shivaedev/identity": minor
---

### Added

- The account `delete` command admits three attempts per person in ten seconds, the budget Better Auth gives `/change-email`, through `@shivaedev/rate-limit` on the host's `Store`, and refuses a further attempt with `TooManyRequests`, which a form hook shows as a notice. `accountDeletion` now requires that `Store`; a host that mounts Better Auth through `betterAuthMount` already provides one.
