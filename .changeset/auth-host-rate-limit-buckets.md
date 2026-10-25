---
"@shivaedev/platform": patch
"@shivaedev/create-app": patch
"@shivaedev/quality": patch
---

### Changed

- Each mounted host owns its in-memory rate-limit buckets and releases them with its scope.
- Starter stories import the application host without resetting modules.
- Application test configuration no longer inlines Better Auth for module resets.
