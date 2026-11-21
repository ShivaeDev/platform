---
"@shivaedev/identity": minor
---

### Added

- `Account` from `@shivaedev/identity/Account.ts` deletes the signed-in person's account through its `identity.account.delete({ password })` command. It confirms the current password with the declaration's configured verifier, then runs the application's hand-over, erases the person's owned rows and deletes their auth rows in one transaction, so a failure anywhere leaves them able to sign in with every row in place. Register it as `module: Account` with `services: accountDeletion(AppAuth)` from `@shivaedev/identity/server/better-auth/accountDeletion.ts`; an application that hands rows over to other people passes its hand-over service, written with `defineService` and providing `handOver(userId)`, as `accountDeletion(AppAuth, { handOver: HandOver })` and provides `HandOver.layer`. Browser code imports the client contract from `@shivaedev/identity/generated/Account.ts`.

### Breaking

- The mount closes Better Auth's `/delete-user` and `/delete-user/callback`, even when the options enable `user.deleteUser`, and the admin plugin's `/admin/remove-user`. An application that deleted accounts through `/delete-user` with a `user.delete.before` hook moves the hook's body into a hand-over service's `handOver(userId)` operation, passes that service to `accountDeletion`, registers the `Account` module and calls `identity.account.delete({ password })` from its client instead of Better Auth's `deleteUser`. An application that removed users through `/admin/remove-user` has no HTTP route for it any more; the person deletes their own account with the command.
