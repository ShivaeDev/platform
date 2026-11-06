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

### Social sign-in

Import `fakeOauthProvider` from `@shivaedev/test-kits/identity/oauth.ts` and acquire it in the story's scope. It runs a loopback OAuth 2.0 / OpenID Connect provider; the application's real Better Auth mount handles the redirects, code exchange and session creation.

```ts
const provider = yield* fakeOauthProvider({
	profile: { sub: "123", email: "alice@example.test", name: "Alice" },
});
```

Use `provider.credentials.clientId` and `clientSecret` in Better Auth. For OIDC, configure its `genericOAuth` plugin with `discoveryUrl: provider.discoveryUrl`, scopes `openid`, `profile`, `email` and `requireIdTokenVerification: true`. Drive `signIn.social` with that provider's ID. The provider publishes RS256 signing keys through JWKS and returns signed ID tokens. For GitHub, use `routeOutbound` from `@shivaedev/test-story/server/routeOutbound.ts` to route `github.com` and `api.github.com` to `provider.server.url` while retaining the real GitHub client.

Consent is accepted by default; yield `provider.refuseConsent()` before visiting the authorization URL to return `access_denied` with the original state. Codes are single-use, bound to the client and redirect URI, and expire after one minute on the acquiring Effect Clock. Set `codeLifetime` to an Effect duration to change that interval. Advance the story clock between the provider redirect and the app callback to exercise expiry. S256 PKCE is checked when the client supplies a challenge. Token exchanges accept client credentials in POST fields or HTTP Basic authentication; issued bearer tokens grant profile access for one hour.

`profile` accepts a subject, email, name and optional `emailVerified` (default true), or a function of the authorization request for multi-user stories. `routes` adds provider-specific HTTP endpoints, such as organization membership. `provider.server` exposes test-story's request observations, holds and fault controls. Keep that composition in the application's story kit. This provider covers authorization-code sign-in; refresh grants, provider logout and a browser consent screen are outside its scope.

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

Import `watchHints`, `layerMemoryProtocol` and the `HintViewer` type from `@shivaedev/test-kits/contract/testing.ts`. `watchHints(stream)` starts a scoped listener and waits for its first update, including a live query’s initial `Result`. Its readout retains `Result`, `Unchanged` and `QueryReadDenied` deliveries. Assert delivered values, or wait on a mounted query's completion signal. `layerMemoryProtocol(group)` connects the native RPC client and server in-process; provide the real group's handlers and middleware.

### Jobs

`linkedWorkerSpans(sender, spans)` from `@shivaedev/test-kits/jobs/testing.ts` reads native recorded Effect spans and returns the pg-boss consumer spans whose links match both the sender's `traceId` and `spanId`. It returns every matching attempt, including retries, and no matches before a worker runs. An untraced job has no sender link. Settle the workers before reading their completed attempts; this readout does not wait or read queue storage.

`testing.ts` gives story kits a controller for one real pg-boss client. Create a fresh controller per runtime, pass its `clientFactory` to `pgBossLayer`, and keep that Layer scoped as usual. `jobs(queue, options?)` returns jobs-owned `Job` metadata with `data` decoded through the queue's Schema, including traced payloads. For a scheduled run with no payload, pass `{ name: Cleanup.name, schema: Schema.Null }` to read `data: null`. Invalid durable data fails with `PgBossPayloadError`; decoding services remain in the Effect's requirements.

This producer story uses the `SendEmail` definition and `Jobs` service from above. `databaseUrl` points to the story's PostgreSQL database:

```ts
import { Context, Effect, Layer, Option } from "effect";
import { TestClock } from "effect/testing";
import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { makePgBossTesting, testRetryPolicy } from "@shivaedev/test-kits/jobs/testing.ts";

const emailStories = storyKit({
	clock: "test",
	*create() {
		const testing = makePgBossTesting({ clock: yield* TestClock.testClockWith(Effect.succeed), retryPolicy: testRetryPolicy });
		const context = yield* Layer.build(
			Jobs.layer({ jobs: [SendEmail] }).pipe(Layer.provide(pgBossLayer({ connectionString: databaseUrl, clientFactory: testing.clientFactory }))),
		);
		return { jobs: Context.get(context, Jobs), testing };
	},
	name: "queued email",
	stages: ["ready"],
	verbs: ({ jobs, testing }) => ({
		enqueue: (userId: number) => jobs.enqueue(SendEmail, { userId }),
		testing,
	}),
});

emailStories.it("decodes the queued email", [], function* ({ enqueue, testing }) {
	const id = Option.getOrThrow(yield* enqueue(42));
	expect(yield* testing.jobs(SendEmail)).toMatchObject([{ id, data: { userId: 42 }, state: "created" }]);
});
```

Set `retryPolicy: testRetryPolicy` through the controller to override queue and send settings with `retryDelay: 0` and `retryBackoff: false`. A failing worker can then exhaust its native retries without production backoff. The policy applies to subsequently sent jobs; it does not rewrite jobs already stored.

To pass time, use the controller's `timePasses` verb with the same native story `TestClock`:

```ts
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { makePgBossTesting } from "@shivaedev/test-kits/jobs/testing.ts";

const testing = makePgBossTesting({ clock: yield* TestClock.testClockWith(Effect.succeed) });
yield* testing.timePasses("1 day");
```

The controller advances the application clock and pg-boss's PostgreSQL clock together, wakes due workers and waits for their settlement. A `RetryAt` later than the new time remains deferred. Provide `testing.clientFactory` to the jobs Layer as above, and use an isolated database for each story. Passing time first waits for existing work to settle; release a held handler before advancing this controller. Supply the story clock so both the application and pg-boss stay under the kit's control.

`schedules()` lists registered schedules as `{ name, cron, timezone }` entries from PostgreSQL. `trigger(schedule)` takes a schedule definition, such as `Cleanup`, and enqueues one run now using its stored schedule data and options. It returns the run ID, or null when pg-boss suppresses the send. Register `Cleanup.run(effect)` in the testing Layer first, then yield `testing.trigger(Cleanup)` and `testing.waitForIdle` before observing the Effect's result. An unregistered schedule fails with `PgBossTestingError` (`operation: "trigger"`).

`refreshQueueStats(queue?)` requests a native pg-boss supervisor pass for one queue, or all queues when omitted, before reading cached counts through the jobs service's `health`. Like the service method, it performs native queue maintenance and respects pg-boss monitor intervals and backoff.

`failNextSend(queue)` arms one send failure for that queue. The next valid `enqueue` fails with the usual typed `PgBossError` (`operation: "enqueue"`); the following send proceeds normally.

`expireAfter(queue, n)` takes a positive attempt count: configure it before enqueueing to limit subsequent jobs to `n` attempts. Each successful send keeps its own expiry rule; later changes and duplicate-ID sends do not alter pending jobs. Earlier attempts run the handler normally; on attempt `n`, the controller expires the claimed job instead of invoking its handler. PostgreSQL supervision performs the terminal failure and dead lettering. A job that succeeds earlier completes normally.

`expireIn(queue, duration)` takes an Effect `Duration.Input`, such as `"1 second"`, and sets the expiry of subsequent sends, rounded up to whole seconds. Durations below one second or nonfinite durations fail with `PgBossTestingError` (`operation: "expireIn"`). Earlier sends retain their expiry, and later calls and duplicate-ID sends do not change stored jobs. Both expiry controls also apply to runs sent by `trigger(schedule)`. It can be combined with `expireAfter`: one sets each attempt's time budget, the other limits attempts. A stuck handler is interrupted at its deadline, and the same worker can fetch its retry after pg-boss fails the attempt. The testing expiry hooks support pg-boss schema version 46.

`runDueNow(queue)` makes future jobs in the queue's `created` or `retry` state due at the database's current time and wakes local workers. It includes delayed sends (`startAfter`), native retries and `RetryAt` deferrals. Yield `waitForIdle` afterwards before observing handler results; future jobs do not hold that wait open. It leaves active and terminal jobs and other queues unchanged.

`deferred(queue)` returns waiting deferrals as `{ at: DateTime.Utc, reason: string }[]`. `runDeferredNow(queue)` pulls those jobs forward to the database’s current time and wakes local workers without waiting for their original due time. Read `revision` before reading deferrals and use `waitForChange(revision)` as with other controls.

`checkBatchWindow(queue, millisecondsPerJob)` checks that the declared sequential batch fits strictly inside the stored queue expiry window. `schemaVersion` reads the installed version, and `checkSchemaVersion(expected)` fails when it differs. Import `PgBossTestingError` and `PgBossWaitError` from `@shivaedev/test-kits/jobs/error.ts`. Test control, read and check failures use `PgBossTestingError` with `operation`, optional `queue` and a redacted `original`.

`snapshot(queues)` reads the unfinished jobs of several queues in one query, so the result is one consistent PostgreSQL snapshot. It returns jobs in the `created`, `retry`, `active` and `failed` states, never completed ones, oldest first by creation. A waiting `RetryAt` job reads as `deferred` while its `startAfter` is in the future; once due, it reads as `retry` until claimed. A retry after a handler failure reads as `retry` even when its next attempt is in the future. Each entry has the job's `id`, `queue` (the definition's name), `state`, `startAfter` as a UTC `DateTime` and `data` decoded by that queue's Schema. Only unfinished rows are decoded, so a completed job whose stored data the Schema no longer accepts does not fail the read; invalid unfinished data fails with `PgBossPayloadError`.

`waitForIdle` discovers queues from the jobs registered in the controller's Layer, including producer-only definitions and schedules; it takes no queue list. It completes when none of those queues has an active job or an unblocked job ready to fetch, including work claimed by another client. Ready jobs keep the wait open even when no local worker runs them. A terminal native worker timeout lets the wait complete after pg-boss fails the job. Jobs whose `startAfter` is in the future do not hold the wait open. While a local fetched batch has no settlement yet, the wait reads nothing and waits for the next local change; otherwise it checks PostgreSQL on local changes and committed job-change notifications from other clients. A kit settles by yielding `waitForIdle` and then reading jobs once. As with any idle snapshot, a producer can enqueue more work after the wait returns.

A kit can also capture `revision` before reading jobs and yield `waitForChange(revision)` when its condition is unmet. The wait resumes after a local send, settlement or worker fetch, and when a local worker returns to idle as `waitForIdle` defines it, including terminal native worker timeouts. It also resumes immediately if a change occurred between the read and the wait. Local deferral settlements advance its revision before the worker continues the batch. It also observes committed job-change notifications from other clients through the inspection service. Future scheduled work and external writes that emit no job notification need their own wake source. Stories should retain a bounded test timeout.

`untilJob(queue, id, state)` waits that way for one job: it reads the job, waits for the next change when the job is in another state, and returns the job with `data` decoded through the queue's Schema once it reaches `state`. It also accepts `{ name, schema: Schema.Null }` for a triggered schedule's run. `fetchesPass(queue, n)` completes once `n` worker fetches on the queue that began after the wait started have finished, whether or not they claimed anything, so a story can show that a job stayed untaken by fetches that could have claimed it. Each fetch also counts as a change for `waitForChange`. Both waits give up after `within` (default 20 seconds) on the caller's Effect clock, so a story forks the wait and advances its `TestClock` to exercise a timeout, and fail with `PgBossWaitError`, whose message names what the wait expected and what it last saw:

```ts
yield* testing.untilJob(SendEmail, id, "completed", { within: "5 seconds" });
// Gave up after 5s waiting until job <id> in send-email is completed; last seen: retry
```

### Host processes and query observations

Import `hostProcess`, `hostProcessReadouts`, `hostTime` and the child IPC helpers from their modules under `@shivaedev/test-kits/host/`. The [host guide](https://github.com/ShivaeDev/platform/tree/main/packages/server#readme) describes real-process setup and lifecycle observations. `hostTime` provides SQL’s `WorkerReleaseClock` scheduling port with the story’s controlled clock. Query observations use `settledQueries` from `@shivaedev/test-kits/contract/settledQueries.ts`; signed webhook senders use `deliverWebhook` from `@shivaedev/test-kits/webhooks/deliver.ts`.

### Development setup

Install `@shivaedev/test-kits` as a development dependency alongside `effect`, Better Auth and the runtime packages used by the kit. The package depends on `@shivaedev/test-story` and `@shivaedev/test-sql`; runtime packages are peers. The [story-testing skill](https://github.com/ShivaeDev/platform/blob/main/packages/skills/skills/story-testing/SKILL.md) describes how to compose an application's facade and prove its behavior.
