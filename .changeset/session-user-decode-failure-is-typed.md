---
"@shivaedev/identity": patch
---

### Changed

- A custom session provider whose user lacks a field `SessionUser` requires, such as `emailVerified`, or carries one of the wrong type, fails the request with `AuthUnavailable` instead of a defect. This holds for every boundary that serves the session user: `AuthenticatedUser`, `AuthenticatedUserWithProviderAccounts`, permission middleware and routes, subject resolvers and `mcpRoutes`. The host logs one error per request that names each such field without its value; the person stays signed in and operations behind `Authenticated` alone keep working.
