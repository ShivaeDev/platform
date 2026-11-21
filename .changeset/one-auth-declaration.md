---
"@shivaedev/identity": minor
"@shivaedev/test-kits": minor
"@shivaedev/create-app": minor
---

### Added

- `@shivaedev/identity`: `defineAuth({ options, roles, defaultRole })` from `server/better-auth/define.ts` is the one place an application states its Better Auth options, its role set and its default role, and it refuses at compile time a default role the role set does not declare. The mount, the demo seed, the user directory, role assignment, the account role seed and the new admin step all take it.
- `@shivaedev/identity`: `provisionAdmin(declaration, role)` from `server/better-auth/provisionAdmin.ts` is the whole create-admin command. It reads `ADMIN_EMAIL`, `ADMIN_NAME` (default `Administrator`), `ADMIN_PASSWORD` and `DATABASE_URL`, finds or creates the user and assigns the role, so running it again for the same address keeps that account and its password instead of failing. It refuses an `ADMIN_PASSWORD` outside the declaration's `emailAndPassword.minPasswordLength` and `maxPasswordLength` (defaults 8 and 128), an empty or unset one included, with `AdminPasswordLength` before anything is stored, and an existing account whose address is not verified with `UnverifiedAdminEmail`, leaving its role unchanged.
- `@shivaedev/identity`: a mount whose declaration names no `database` opens Better Auth on the application's `SqlClient`, so callers no longer pass `database: yield* betterAuthDatabase()`.
- `@shivaedev/test-kits`: `mintUser(declaration, host, name, { role })` in `identity/adapters/betterAuth.ts` returns a signed-in user from the application's auth declaration, through a test-only mount with Better Auth's `testUtils()`, the host's origin and secure-cookie choice and the declaration's `secret` or the exported `AUTH_TEST_SECRET`. `storyAuth(declaration, host)` returns that test-only Better Auth instance. The package now declares `@shivaedev/rate-limit` as a peer.

### Changed

- `@shivaedev/create-app`: generated apps state their auth once in `src/server/AppAuth.ts`. `src/server/authOptions.ts`, `src/server/admin/adapters/signUpEmail.ts` and `src/test-support/sessionPrecondition.ts` are gone; `src/server/admin/create.ts` is one `provisionAdmin` call, so `pnpm admin:create` run again for a registered email keeps that account; story kits mint users with test-kits' `mintUser(AppAuth, host, name, { role })`; and the story host passes `AUTH_TEST_SECRET` as `BETTER_AUTH_SECRET` instead of `applicationHost`'s removed `secret` option. Generated resource kits import `mintUser` from test-kits.

### Breaking

- `@shivaedev/identity`: `betterAuthMount(options, { roles, defaultRole, ...host })` becomes `betterAuthMount(declaration, host)`: move the options, `roles` and `defaultRole` into `defineAuth({ options, roles, defaultRole })` and keep only host additions (`emails`, `databaseHooks`, `onPasswordReset`, `bearerSessions`, `roleSeed`, `hardening`, `signIn`, `clientIp`, `preset`, `enabledPaths`, `accountPreferences`) in the second argument. Drop `database: yield* betterAuthDatabase()` from the options; a mount without a `database` now requires `SqlClient`, so a story that relied on Better Auth's in-memory default passes `database: memoryAdapter({ account: [], session: [], user: [], verification: [] })`.
- `@shivaedev/identity`: `defineSeed({ auth, defaultRole, roles, users, run })` becomes `defineSeed(declaration, { users, run })`, and `SeedOptions` keeps only `users` and `run`.
- `@shivaedev/identity`: `betterAuthUserDirectory(access, options)` becomes `betterAuthUserDirectory(declaration)`.
- `@shivaedev/identity`: `assignRole(access, userId, role, options)` becomes `assignRole(declaration, userId, role)`; trusted code with only a role set and default tables passes `{ roles }`.
- `@shivaedev/identity`: `accountRoleSeed(access, role, accounts, options)` becomes `accountRoleSeed(declaration, role, accounts)`.
- `@shivaedev/identity`: `seedUsers(seedOptions)` becomes `seedUsers(declaration, { users, run })`, matching `defineSeed`.
- `@shivaedev/identity`: `assertBetterAuthSchema(options, { defaultRole })` becomes `assertBetterAuthSchema(declaration)`; pass the auth declaration, or `{ options, defaultRole }` where no role set exists.
- `@shivaedev/identity`: `migrateBetterAuth(options, { defaultRole })` becomes `migrateBetterAuth(declaration)`, and `authTestDatabase`'s `migrate` follows it; pass the auth declaration, or `{ options, defaultRole }`.
- `@shivaedev/identity`: `generateBetterAuthMigration(options, { defaultRole })` becomes `generateBetterAuthMigration(declaration)`; pass the auth declaration, or `{ options, defaultRole }`.
- `@shivaedev/identity`: `UserProvisioning`'s `findOrCreateUser` also returns `emailVerified`; another implementation of the port returns whether the found or created account's address is verified.
