---
"@shivaedev/identity": minor
"@shivaedev/react": minor
---

### Added

- Identity's `betterAuthMount` accepts `onPasswordReset`, an Effect callback that runs with the host's context and composes after Better Auth's native reset callback.
- React's `permissionGuard` accepts `hidden: true` to render TanStack Router's not-found page when a signed-in viewer lacks a required permission.
