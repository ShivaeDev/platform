---
"@shivaedev/identity": minor
"@shivaedev/admin": patch
---

### Breaking

- `@shivaedev/identity`: `AccountPreferences` moved from `@shivaedev/identity/accountPreferences.ts` to `@shivaedev/identity/AccountPreferences.ts`, and `Sessions` from `@shivaedev/identity/sessions.ts` to `@shivaedev/identity/Sessions.ts`. Both are now modules built with `defineModule`, and both files are server code. Register them with `module: AccountPreferences` or `module: Sessions` in an `AppModule`, or serve them with `moduleHandlers(Sessions)` from `@shivaedev/contract/moduleHandlers.ts`, for example as admin's `sessions` handlers. `accountPreferencesHandlers` (`@shivaedev/identity/server/accountPreferencesHandlers.ts`) and `sessionsHandlers` (`@shivaedev/identity/server/better-auth/sessionsHandlers.ts`) are removed.
- `@shivaedev/identity`: Browser code imports the client contracts `AccountPreferences` from `@shivaedev/identity/generated/AccountPreferences.ts` and `Sessions` from `@shivaedev/identity/generated/Sessions.ts`.
- `@shivaedev/identity`: `AccountPreferenceValues`, `AccountTimezone` and `accountPreferenceKeys` moved from `@shivaedev/identity/accountPreferences.ts` to `@shivaedev/identity/accountPreferenceValues.ts`. `SignedInSession`, `SessionCursor` and `SessionListInput` moved from `@shivaedev/identity/sessions.ts` to `@shivaedev/identity/signedInSessions.ts`, which also exports the sessions collection as `sessionKeys`. The `SessionList` schema is now the `SessionList` type there: replace `typeof SessionList.Type` with `SessionList`.
- `@shivaedev/identity`: `identity.sessions.list` takes its success from what the operation returns, so `next` travels as an encoded `Option` instead of a nullable cursor; deploy the browser and the server together.

### Changed

- `@shivaedev/admin`: The sessions page uses identity's generated sessions contract, so a browser bundle with the page holds none of identity's server code.
