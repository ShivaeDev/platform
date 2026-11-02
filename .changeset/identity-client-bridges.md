---
"@shivaedev/identity": minor
"@shivaedev/react": minor
"@shivaedev/create-app": patch
---

### Added

- `@shivaedev/identity`: Browser client adapters expose Better Auth calls, queries and session reads as Effects, with typed failures and session permission decoding.

### Breaking

- `@shivaedev/react`: Import `authCall` and `AuthActionResult` from `@shivaedev/identity/client/adapters/authCall.ts` instead of `@shivaedev/react/client/authAction.ts`. Import `AuthFailure` from `@shivaedev/identity/client/AuthFailure.ts` and the `AuthFailureCode` schema and type from `@shivaedev/identity/client/AuthFailureCode.ts`.
- `@shivaedev/react`: React's `authAction` now accepts an input-to-Effect function: replace `authAction(runPromise)` with `authAction(authCall(runPromise))` using identity's bridge. React's `authQuery` also accepts an input-to-Effect function: wrap the Promise reader with `authQuery` from `@shivaedev/identity/client/adapters/authQuery.ts` before passing it to React's atom family.
- `@shivaedev/react`: React's `authSession` now accepts a session Effect: wrap the Promise reader with `authSession` from `@shivaedev/identity/client/adapters/authSession.ts` before passing it to React's session atom. Import `SessionWithPermissions` from that identity adapter instead of React's session module. `AuthSession<A, E>` now exposes exactly `E`; include `AuthUnavailable` in `E` when explicitly annotating an identity-backed session.
- `@shivaedev/react`: Import the `PermissionSession` schema and type from `@shivaedev/identity/PermissionSession.ts` instead of `@shivaedev/react/permissions.ts`. Import `can` from `@shivaedev/react/can.ts` instead of `@shivaedev/react/permissions.ts`. The removed exports have no compatibility aliases.

### Changed

- `@shivaedev/create-app`: Generated apps use identity's Better Auth client adapters and pass their Effects to React's atom helpers.
