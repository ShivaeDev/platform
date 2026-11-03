# @shivaedev/test-kits

Reusable building blocks let application stories send real email requests, start signed in and observe committed changes without carrying test infrastructure in production dependencies.

## Compose a story's preconditions

Keep the application's engine running and give its local story kit the preconditions and readouts it needs.

```ts
import { signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";

const alice = yield* signedInUser(auth, { email: "alice@example.test", name: "alice" });
const response = yield* client.get("/notes", { headers: alice.headers });
```

The signed-in precondition mints a session; it does not exercise the application's sign-in flow. Keep sign-in stories at that flow's real boundary.

## Use the building blocks

Compose these helpers in the application's `test-support` facade. Keep actions and observations there and assertions in the spec. Effect owns each helper's scope, clock and failures.

### Email delivery

Import `inbox`, `emailLink` and the `ReceivedEmail` type from `@shivaedev/test-kits/email/adapters/inbox.ts`. Acquire `inbox()` in a scope and provide its `mailerLayer` to the real email worker. It routes the Resend SDK to a loopback HTTP provider. `nextEmail` waits for the next accepted message, `emails()` reads accepted messages and `endpoint` exposes provider controls. `emailLink(email)` extracts the first HTTP link from its text.

### Signed-in identities

Import `signedInUser`, `signInAgain`, `passwordUser` and `storedProviderAccounts` from `@shivaedev/test-kits/identity/adapters/betterAuth.ts`. They use Better Auth's adapter without requiring its test plugin. `signedInUser(auth, fields)` returns the user, session, headers, cookies and token. Optional `providerAccounts` attach provider identities. `signInAgain(auth, userId)` renews the same user's session on the caller's Effect Clock. `passwordUser` accepts either `password` or `passwordHash`; use an existing hash when password hashing is only a precondition. `storedProviderAccounts` reports credential-presence booleans without returning credential values.

### SQL change coverage

Import `withChangeCoverage`, `expectPublished`, `UnannouncedWrites`, `PublishedKeysMismatch` and the `ChangeCoverage` type from `@shivaedev/test-kits/sql/testing.ts`. `withChangeCoverage(body, { covers }?)` checks PostgreSQL write counters inside `transact` and rolls back writes without declared, recorded keys. `body.pipe(expectPublished(keys))` checks distinct published keys after the body; a mismatch cannot undo a completed commit. The [change guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/changes.md) explains declarations and publication boundaries. Compose these with [test-sql](https://github.com/ShivaeDev/platform/tree/main/packages/test-sql#readme) for PostgreSQL isolation.

### Contract subscriptions

Import `watchHints`, `heard`, `layerMemoryProtocol` and the `HintViewer` type from `@shivaedev/test-kits/contract/testing.ts`. `watchHints(stream)` starts a scoped listener and waits for its first hint. `heard(viewer, keys, { within }?)` reports whether a delivered changed hint contains all requested keys, using a one-second Effect-clock deadline by default. `layerMemoryProtocol(group)` connects the native RPC client and server in-process; provide the real group's handlers and middleware.

### Development setup

Install `@shivaedev/test-kits` as a development dependency alongside `effect`, Better Auth and the runtime packages used by the kit. The package depends on `@shivaedev/test-story` and `@shivaedev/test-sql`; runtime packages are peers. The [story-testing skill](https://github.com/ShivaeDev/platform/blob/main/packages/skills/skills/story-testing/SKILL.md) describes how to compose an application's facade and prove its behavior.
