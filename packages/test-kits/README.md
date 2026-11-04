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

### Discord bots

Import `fakeDiscord` from `@shivaedev/test-kits/discord/fake.ts` and acquire it in a scope. Its loopback `server` retains messages across creation, editing, history reads and deletion, and supports the standard fake HTTP fault controls. Use the token `story-discord-token` with the real Discord REST client and set its API URL to `server.url`. Provide `gateway.transport` as the real gateway client's `GatewayTransport`; it speaks identify, heartbeat and resume frames, retains sessions and replays dispatches emitted during a dropped connection. `gateway.dispatch(type, data)`, `drop(code?)` and `invalidate(resumable)` change the provider, while `frames` and `urls` expose outbound observations. Drive reconnect and rate-limit time through the story kit's controlled clock.

### GitHub Apps

Import `fakeGitHubApp` from `@shivaedev/test-kits/github/fake.ts` and acquire it in a scope. The provider exchanges signed App JWTs for installation tokens over loopback HTTP. Give the real `@shivaedev/github` client its `credentials.appId`, redacted `credentials.privateKey`, an installation ID and `server.url` as `GitHubConfig.apiUrl`.

```ts
const github = yield* fakeGitHubApp({
 routes: ({ installationToken }) => ({
  repository: {
   guard: installationToken,
   path: "/repos/acme/widgets/issues/3",
   reply: () => ({ body: { title: "Ship widgets" } }),
  },
 }),
});
```

`routes` uses test-story's named fake HTTP routes for REST reads and writes and GraphQL POSTs. `installationToken` admits issued tokens, `installationOf(request)` returns their installation ID, and `appRequest` checks an App JWT. Routes own their paths; `prefix` changes the token exchange path for Enterprise API bases. Supply `credentials` from `githubAppCredentials()` in `@shivaedev/test-kits/github/adapters/credentials.ts` when several fixtures need the same App key.

`server.requests` records method, path, headers and raw body; `server.scriptFault`, `hold` and the other fake HTTP controls drive rate limits and delayed or refused exchanges. Return rate-limit headers on routes or script a 403/429 reply with `retry-after` to exercise the real client's typed rate-limit handling. The kit does not simulate a GitHub database or interpret GraphQL queries: route replies describe the outside provider's data.

For token-free scripted REST scenarios, `fakeGitHub` from `@shivaedev/test-kits/github/adapters/rest.ts` adds `reply(endpoint, body, { headers?, status? })`, ETag revalidation, a mutable core `budget` and recorded `requests`. Acquire its `serve` Effect and point the real client at the returned server. It uses the same provider as the App kit.

`deliverWebhook(url, { body, event, deliveryId })` sends the exact body bytes over HTTP with GitHub event, delivery and HMAC signature headers, consumes the receiver's response and returns its status. Configure the receiver with `credentials.webhookSecret`; `credentials.webhookSignature(body)` is available for signature-specific stories. Drive token expiry and rate-limit time through the story clock. No client implementation is replaced.

### MCP bearer tokens

Import `mcpBearerToken` from `@shivaedev/test-kits/mcp/adapters/bearerToken.ts`. With the application's mounted Better Auth instance (JWT and MCP provider plugins enabled), an existing signed-in user and OAuth client, mint the token precondition:

```ts
const access = yield* mcpBearerToken(auth, {
	userId: alice.user.id,
	clientId: client.clientId,
	resource: `${publicUrl}/mcp`,
});
```

The verb creates a persisted `mcp` consent grant and signs a bearer token with the app's advertised issuer and JWT key. It includes the subject, client, grant, resource audience, scope, issued-at and one-hour expiry on the Effect Clock. The result contains `token`, bearer `headers` and `grantId`. Use the token with the app's real MCP adapter; revoking the grant refuses it. This mints a precondition and does not exercise browser OAuth consent or code exchange.

### SQL change coverage

Import `withChangeCoverage`, `expectPublished`, `UnannouncedWrites`, `PublishedKeysMismatch` and the `ChangeCoverage` type from `@shivaedev/test-kits/sql/testing.ts`. `withChangeCoverage(body, { covers }?)` checks PostgreSQL write counters inside `transact` and rolls back writes without declared, recorded keys. `body.pipe(expectPublished(keys))` checks distinct published keys after the body; a mismatch cannot undo a completed commit. The [change guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/changes.md) explains declarations and publication boundaries. Compose these with [test-sql](https://github.com/ShivaeDev/platform/tree/main/packages/test-sql#readme) for PostgreSQL isolation.

### Contract subscriptions

Import `watchHints`, `heard`, `layerMemoryProtocol` and the `HintViewer` type from `@shivaedev/test-kits/contract/testing.ts`. `watchHints(stream)` starts a scoped listener and waits for its first hint. `heard(viewer, keys, { within }?)` reports whether a delivered changed hint contains all requested keys, using a one-second Effect-clock deadline by default. `layerMemoryProtocol(group)` connects the native RPC client and server in-process; provide the real group's handlers and middleware.

### Development setup

Install `@shivaedev/test-kits` as a development dependency alongside `effect`, Better Auth and the runtime packages used by the kit. The package depends on `@shivaedev/test-story` and `@shivaedev/test-sql`; runtime packages are peers. The [story-testing skill](https://github.com/ShivaeDev/platform/blob/main/packages/skills/skills/story-testing/SKILL.md) describes how to compose an application's facade and prove its behavior.
