---
"@shivaedev/access": minor
"@shivaedev/identity": minor
"@shivaedev/react": minor
"@shivaedev/rate-limit": minor
"@shivaedev/admin": patch
---

### Added

- `@shivaedev/access`: `MissingPermission` in `refusal.ts` is the `cause` of every `Forbidden` that `forbidden(permission)` builds; its `permission` names the grant that was missing, for logs and for code.

### Changed

- `@shivaedev/access`: `forbidden(permission)` says "You do not have permission to do this." instead of naming the permission, because the client shows a shared rejection's message to the person as it arrives.
- `@shivaedev/identity`: every `Unauthorized` it raises says "Sign in to continue", as access's `unauthorized()` does, instead of "Authentication required". A request from an origin the session policy refuses says "Open this application from its own address to continue.", a user without a stored role "Your account has no role yet. Ask an administrator to assign one.", a missing user "This user no longer exists." and a missing session "This session has already ended."
- `@shivaedev/rate-limit`: a refused attempt's `TooManyRequests` says "Too many attempts. Wait a moment and try again." instead of "Rate limit exceeded".
- `@shivaedev/admin`: unreadable job page options are refused with "This page of jobs could not be read. Open the jobs page again." instead of "Invalid job page options".
- `@shivaedev/react`: when a command or form save succeeds, the failure notices that same hook published earlier go without Dismiss. A notice nobody resolves still stays until dismissed or expired.

### Breaking

- `@shivaedev/access`: code that read the permission out of a `Forbidden` message reads `error.cause.permission` after checking `error.cause instanceof MissingPermission`; branch on the `Forbidden` tag, never on its message.
- `@shivaedev/identity`: code that compared the message of identity's `Unauthorized`, `Forbidden` or `NotFound` with the old text branches on the tag instead.
- `@shivaedev/rate-limit`: code that compared `TooManyRequests.message` with "Rate limit exceeded" branches on the tag, `key` or `retryAt` instead.
- `@shivaedev/react`: a function provided to `FailureHostContext` returns the published notice's dismiss function, or `undefined` when it published nothing.
