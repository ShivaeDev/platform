---
"@shivaedev/admin": minor
"@shivaedev/create-app": patch
---

### Breaking

- `@shivaedev/admin`: Move admin's default React views and their supporting modules from `@shivaedev/admin/client/` to `@shivaedev/admin/client/adapters/`. Change the import prefix for `UsersView.ts`, `UsersTable.ts`, `SessionsView.ts`, `SessionConfirmation.ts`, `SessionListView.ts`, `SessionPagination.ts`, `JobsView.ts`, `JobsMetrics.ts`, `JobsQueryPanel.ts`, `JobsQueueView.ts`, `JobButton.ts`, `JobDetail.ts`, `JobList.ts`, `JobPagination.ts`, `JobTable.ts` and `jobsTypes.ts`; exported names stay the same. The old paths have no aliases. Point Tailwind sources at `@shivaedev/admin/src/client/adapters`.
- `@shivaedev/admin`: Make `react`, `@effect/atom-react` and `@shivaedev/react` optional peers of admin. Applications using the default views must install all three explicitly; registry, contract and guard consumers need only the required `effect` peer.

### Fixed

- `@shivaedev/create-app`: Generate starter apps with the new admin view imports and Tailwind source paths.
