---
"@shivaedev/identity": minor
---

### Fixed

- Better Auth sign-in callbacks run Effects in an adapter with the mount's captured context and the request's AbortSignal. Cancelling an auth request interrupts its waiting sign-in policy.

### Breaking

- Move direct imports of `signInPolicyOptions` from `server/better-auth/signInPolicy.ts` to `server/better-auth/adapters/signInPolicyOptions.ts`. Yield the returned Effect when building the mount and remove the runner argument; the adapter captures its own context. The `PolicyRun` type is removed. Applications using `betterAuthMount` need no changes.
