---
"@shivaedev/identity": minor
---

### Added

- `Account` from `@shivaedev/identity/Account.ts` deletes the signed-in person's account through its `identity.account.delete({ password })` command. It confirms the current password with the declaration's configured verifier, then runs the application's hand-over, erases the person's owned rows and deletes their auth rows in one transaction, so a failure anywhere leaves them able to sign in with every row in place. Register it as `module: Account` with `services: accountDeletion(AppAuth, { handOver })` from `@shivaedev/identity/server/better-auth/accountDeletion.ts`; browser code imports the client contract from `@shivaedev/identity/generated/Account.ts`.

### Breaking

- The mount closes Better Auth's `/delete-user` and `/delete-user/callback`, even when the options enable `user.deleteUser`. An application that deleted accounts there with a `user.delete.before` hook moves the hook's body into the `handOver` Effect given to `accountDeletion`, registers the `Account` module and calls `identity.account.delete({ password })` from its client instead of Better Auth's `deleteUser`.
