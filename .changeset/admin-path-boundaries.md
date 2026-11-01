---
"@shivaedev/quality": minor
"@shivaedev/create-app": minor
---

### Added

- Enforce `imports/admin-paths`: report admin-only source files outside an `admin/` path and admin files reached by member code, naming the destination folder. Follow production imports within each source tree while allowing registration composition and shared member dependencies.

### Breaking

- Generated apps keep shared declarations outside the admin-only tree. Migrate custom `ReadStatistics` imports from `#admin/ReadStatistics.ts` to `#ReadStatistics.ts`, and custom `AdminNavigation` type imports from `#client/admin/Shell.tsx` to `#client/AdminNavigation.ts`.
