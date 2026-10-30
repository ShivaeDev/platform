---
"@shivaedev/create-app": patch
---

### Fixed

- A template that names no exact published version now refuses with the message alone, without a `CreateAppError:` prefix.
- A failed initial commit names the Git command as `git commit -m 'Initialize a generated app'`, without the fallback identity flags.
