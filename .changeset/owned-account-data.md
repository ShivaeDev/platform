---
"@shivaedev/identity": minor
---

### Added

- `accountData(declaration, reference?)` from `@shivaedev/identity/server/better-auth/accountData.ts` exports and erases a person's data from the owned models the host reports through sql's owner marks. `exportAccount(userId)` returns the person's auth profile, linked accounts and sessions without credentials, plus each owned model's rows of theirs encoded through its JSON variant, so a server-only field never appears. `eraseOwnedRows(userId)` deletes every owned row of the person inside the caller's transaction, in an order computed from PostgreSQL's foreign keys between the owned tables, and fails with `OwnedTableCycle` naming the tables before it deletes anything when `RESTRICT` or `NO ACTION` keys form a cycle. `check` fails with `UncoveredUserColumns` naming each `{ schema, table, column }` whose foreign key points at the auth user or an owned model's owner column but which is neither an owned model's owner column, `ON DELETE SET NULL`, nor part of Better Auth's tables; export and erase run it first.
- Identity's account preferences mark their id as owner, so they are exported and erased with the person's other owned rows.

### Breaking

- `accountExport(registrations, reference?)` from `server/accountExport.ts`, `UserDataExport`, `UserExportTable` and `UserExportReference` from `server/userDataExport.ts`, `checkUserDataExports` and `UnregisteredUserExportTables` from `server/account-export/check.ts` are removed, and `betterAuthUserDataExport(options, schema)` from `server/better-auth/userDataExport.ts` becomes `profileExport(options, schema)` from `server/better-auth/profileExport.ts`, which returns the export Effect alone and which `accountData` includes as `account`. To migrate, mark each domain model's owner field with `owner` from `@shivaedev/sql/owner.ts`, give a table the application reads only through raw SQL a repository on a model with an owner mark so the host reports it, delete the per-domain registrations, and call `accountData(AppAuth)` in their place: `exportAccount` replaces `exportUser` and returns `{ account, owned }` instead of one entry per domain, and `check` replaces the registration check. Pass a customized user reference as `accountData`'s second argument instead of `accountExport`'s.
