---
"@shivaedev/identity": minor
"@shivaedev/server": patch
---

### Breaking

- `@shivaedev/identity`: The account preferences plugin moves to a browser-safe path and a new name. Replace `import { preferencesClient } from "@shivaedev/identity/server/better-auth/preferencesClient.ts"` with `import { preferencesPlugin } from "@shivaedev/identity/client/preferencesPlugin.ts"` and call `preferencesPlugin()` where you called `preferencesClient()`. Its header names come from `accountPreferenceHeaders` in `@shivaedev/identity/accountPreferenceHeaders.ts`.

### Fixed

- `@shivaedev/server`: CORS on the auth routes allows the `x-platform-account-timezone` and `x-platform-account-locale` headers next to `Authorization` and `Content-Type`, so a bundled native shell with the preferences plugin installed passes the preflight and signs in; a declared sibling browser origin's preflight allows them too. The RPC path still allows only `Authorization` and `Content-Type`.
