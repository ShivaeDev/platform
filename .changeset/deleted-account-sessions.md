---
"@shivaedev/identity": patch
---

### Fixed

- The account `delete` command refuses with `PreconditionFailed` before anything else when the auth declaration configures `secondaryStorage`, where Better Auth keeps answering a deleted person's sessions with the user it cached. It previously failed on the missing `verification` table.
