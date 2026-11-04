---
"@shivaedev/identity": minor
"@shivaedev/create-app": minor
---

### Added

- `@shivaedev/identity`: Declare local demo personas with `defineSeed`: find or create password users, assign their application roles and run an Effect as each user. Non-local database URLs are refused before connecting.
- `@shivaedev/identity`: Provision password users through `UserProvisioning` and `betterAuthUserProvisioning`, reusing accounts by email without replacing their profile or password.
- `@shivaedev/create-app`: Generated apps include `pnpm db:seed` with a declaration for local owner and user demo personas.
