---
"@shivaedev/identity": minor
---

### Breaking

- `signedInUser(auth, fields)` returns an Effect instead of a Promise so session minting reads the caller's Clock. In Effect code, replace `yield* Effect.promise(() => signedInUser(auth, fields))` with `yield* signedInUser(auth, fields)`. At a Promise boundary, run it with `Effect.runPromise` or the application's Effect runtime.

### Fixed

- Signed-in test sessions expire after Better Auth's configured session lifetime on Effect's Clock, so stories set decades ahead stay signed in until that lifetime ends.
