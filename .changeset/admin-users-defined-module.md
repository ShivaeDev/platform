---
"@shivaedev/admin": minor
---

### Breaking

- The Users page is a fixed page instead of a factory: replace `usersPage(AppAccess)` from `@shivaedev/admin/users/page.ts` with `UsersPage` from `@shivaedev/admin/users/Page.ts`. Its operations are the module `Users` from `@shivaedev/admin/Users.ts`, which is server code; register them with `users: moduleHandlers(Users)`, with `moduleHandlers` from `@shivaedev/contract/moduleHandlers.ts`. `usersHandlers` (`@shivaedev/admin/server/usersHandlers.ts`) is removed. Browser code that needs the client contract imports `Users` from `@shivaedev/admin/generated/Users.ts`.
- `admin.users.changeRole` takes the role as a string. The application's role set still decides which roles exist: `betterAuthUserDirectory(AppAccess, ...)` refuses an undeclared role with `AuthUnavailable` before writing anything.
- The `UsersList` schema from `@shivaedev/admin/users/page.ts` is now the `UsersList` type from `@shivaedev/admin/users/List.ts`: replace `typeof UsersList.Type` with `UsersList`.
- `admin.users.list` takes its success from what the operation returns, so `next` travels as an encoded `Option` instead of a nullable cursor; deploy the browser and the server together.

### Added

- An admin page's operations can be a module built with `defineModule`: pass the generated client contract to `adminPage` and register `moduleHandlers(Module)` for the page, beside pages with hand-written handlers in the same registry.
- The package's build writes `src/generated` and `dist/generated` before compiling, so the published archive holds the generated client contracts.
