# @shivaedev/webhooks

Receive signed webhooks without building signature checks, delivery deduplication and receipt logging in every application. One route records a delivery and queues its work atomically; your workers own the feature.

## Receive once, work in queues

A sender can retry or send concurrent copies. Your application declares which events become jobs, and the inbox queues them once per source and delivery ID.

```ts
const sources = {
	github: githubSource({
		key: Config.Redacted("GITHUB_WEBHOOK_SECRET"),
		events: {
			issues: webhookEvent(IssueEvent, ({ issue }) => [webhookJob(IndexIssue, { number: issue.number })]),
		},
	}),
};
```

## Using the inbox

A source has a name, a verification strategy, a signing key loaded through Effect Config, and event registrations. Strategies read delivery identity and event names from headers and verify the raw bytes before JSON decoding. Event schemas describe only the fields your application needs; the mapping returns typed job requests, directly or in an Effect. No worker handler runs in the route.

### Register receipts and queues

Register `webhookReceipts` in the host's `migrations.components` alongside `pgBossSchema()`. The normal migration mode applies it; `check` reports missing or pending receipt migrations, and `wait` waits for them. The receipt table is `webhook_receipts`, keyed by `(source, delivery_id)`, with the event, a UTC `timestamptz` received time, `queued` or `ignored` outcome, and a `text[]` column of queued job IDs. The component applies numbered migrations recorded in `webhook_receipts_migrations`, preserving existing receipts when their schema changes.

When upgrading a database whose `job_ids` column is JSON, stop the older receivers, apply `webhookReceipts`, then start the new receivers. Direct SQL readers use PostgreSQL array operations for `job_ids`.

```ts
import { Config, Effect, Layer, Redacted, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import { makePgBoss, pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { githubSource } from "@shivaedev/webhooks/server/github.ts";
import { webhookEvent, webhookJob } from "@shivaedev/webhooks/server/registration.ts";
import { webhookRoute } from "@shivaedev/webhooks/server/route.ts";
import { webhookReceipts } from "@shivaedev/webhooks/server/webhookReceipts.ts";

const Jobs = makePgBoss("app/Jobs");
const IndexIssue = defineQueue({
	name: "index-issue",
	schema: Schema.Struct({ number: Schema.Number }),
});
const IssueEvent = Schema.Struct({
	issue: Schema.Struct({ number: Schema.Number }),
});
const sources = {
	github: githubSource({
		key: Config.Redacted("GITHUB_WEBHOOK_SECRET"),
		events: {
			issues: webhookEvent(IssueEvent, ({ issue }) => [webhookJob(IndexIssue, { number: issue.number })]),
		},
	}),
};

const Host = appHost({
	config: { databaseUrl },
	migrations: {
		loader,
		components: [pgBossSchema(), webhookReceipts],
	},
	application: Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const jobs = Jobs.layer({ jobs: [IndexIssue] }).pipe(Layer.provide(pgBossLayer({ connectionString: databaseUrl, migrate: false })));
		return {
			group: Api,
			handlers,
			sessions,
			services: jobs,
			routes: webhookRoute({ basePath: "/webhooks", jobs: Jobs, sources }).pipe(
				Layer.provide(jobs),
				Layer.provide(Layer.succeed(SqlClient.SqlClient, sql)),
			),
		};
	}),
});
```

`databaseUrl`, `loader`, `Api`, `handlers` and `sessions` are the application's existing host inputs. The route above receives GitHub deliveries at `POST /webhooks/github`. It uses the existing `appHost.routes` option and the host's `maxBodySize`; the jobs client and SQL client must point at the same PostgreSQL database. Register workers separately with the job definitions' `handle` method, in the processes your application chooses. A missing signing key fails the route Layer with `ConfigError`; composing it into `Host` preserves that typed error for the application's startup to handle.

### Decide with services

The `webhookEvent` mapping can return an Effect to read application services and the clock before accepting a verified delivery. Return an empty array to ignore it, or fail with a typed error to refuse it. Pure mappings keep the same signature.

```ts
const issues = webhookEvent(IssueEvent, ({ issue }) =>
	Effect.gen(function* () {
		const preferences = yield* SenderPreferences;
		const now = yield* Clock.currentTimeMillis;
		if (!(yield* preferences.allows(issue.sender, now))) return [];
		return [webhookJob(IndexIssue, { number: issue.number })];
	}),
);
```

`Clock` comes from `effect`; `SenderPreferences` and its `allows` method belong to the application, as does the sender field in its event schema. Supply the mapping's services to `webhookRoute` with `Layer.provide`; they remain required in the route Layer's type. `WebhookEvent<R, E>` and `WebhookSource<R, E>` preserve the mapping's service requirements and typed failures. The mapping runs after verification and schema decoding, inside the receipt transaction. Each request gives its mapping a separate scope and releases acquired resources before answering, including on failure. Interrupting a mapping releases its resources and rolls back its receipt, allowing a retry. An ignored delivery commits an ignored receipt with no jobs. A failed check rolls back the receipt and any transactional database changes; the sender can retry. Duplicate deliveries skip the mapping.

### Answers and retries

| Request                                    | Status | Body               |
| ------------------------------------------ | ------ | ------------------ |
| Registered event maps to jobs              | 202    | `queued`           |
| Unlisted event, or mapping returns no jobs | 200    | `ignored`          |
| Source and delivery ID already recorded    | 200    | `already queued`   |
| Unregistered source                        | 404    | Empty              |
| Missing or wrong signature                 | 401    | Empty              |
| Missing delivery ID or event header        | 400    | `Invalid delivery` |
| Payload rejected by its Schema             | 400    | Empty              |
| Body exceeds the host limit                | 413    | Empty              |
| Mapping, database or enqueue failure       | 503    | Empty              |

Refused requests create no receipt and no jobs. Signatures are checked before decoding; unlisted events are verified and recorded without decoding. The signing key, signature and raw body stay out of responses, logs and spans.

Mapping, database and enqueue failures log `Webhook receipt failed` and `errorTag` at error level before the empty 503 response. The HTTP request span records the failure with its original tag. Receiving a delivery runs under the `Webhooks.receive` span.

`webhookEvent` wraps payload decoding failures in `WebhookPayloadError` from `@shivaedev/webhooks/server/WebhookPayloadError.ts`, retaining the original `SchemaError` in `cause`. Direct callers catch `WebhookPayloadError` for invalid payloads. Custom `WebhookEvent.decode` implementations wrap only payload schema failures in `new WebhookPayloadError({ cause })`; application failures keep their original types. An application `SchemaError` receives a logged 503, and frozen tagged failures retain their tag in diagnostics without being mutated.

The receipt insert and every enqueue use one SQL transaction. Concurrent copies wait on the receipt's unique key: a committed first copy makes the second a duplicate; a rolled-back first copy lets the second receive the delivery itself. If any enqueue fails, earlier enqueues and the receipt roll back, and the sender's retry can succeed. Receipts for ignored events are deduplicated too.

### Payload privacy

The inbox keeps raw request bytes in memory for signature verification and decoding. It does not store the raw body or a copy of the decoded event. Its persistence and diagnostic boundary is:

| Destination        | Data retained                                                                                                                                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webhook_receipts` | Source name, delivery ID and event from headers, received time, outcome and queued job IDs. No payload fields.                                                                                                                                                             |
| Job storage        | The encoded payloads your mapping explicitly passes to `webhookJob`, plus job metadata and trace context. Schema selection alone does not choose what is persisted; the mapping does.                                                                                      |
| Logs               | Receipt failure message and error tag (`Unknown` for untagged failures), alongside host request diagnostics. No body, payload fields, original error messages, stacks, custom properties or nested causes from receiving work.                                             |
| Exported telemetry | HTTP, receive, SQL and job spans with request, database, queue and trace metadata, status and error tags. Receiving failures are reduced to their tags before transaction and receive spans finish; payload values in their messages, properties and causes are discarded. |

The signing key and signature stay out of these diagnostics and receipts. Payload fields omitted from job mappings stay out of storage, logs and exported telemetry, including fields rejected by a schema and fields copied into a mapping's failure or defect. Responses contain only the status bodies listed above.

Use stable error tags defined by application code; never derive `_tag`, source names, delivery IDs, event headers or queue names from private payload data. Applications own what they put in mapped jobs and any logs or spans they emit themselves, including inside mappings, custom strategies, schema transformations and workers. The inbox cannot remove data those callbacks export directly. It does not apply a retention policy to receipts or queued jobs; applications manage their database retention.

### Other senders

`githubSource` supplies `githubStrategy`, which checks `X-Hub-Signature-256` through `@shivaedev/github` and reads `X-GitHub-Delivery` and `X-GitHub-Event`. Each key is a `Config.Config<Redacted.Redacted<string>>` and is resolved when the route Layer starts.

For another sender, supply a `WebhookSource` from `registration.ts` with its own `WebhookStrategy`. Its `verify(body, headers, key)` returns an Effect that fails with `WebhookUnauthorized` from `WebhookUnauthorized.ts` for invalid signatures. Its `delivery(headers)` returns `{ id, event }`; neither field comes from the payload. The route, receipts and queue mapping stay the same.

### Send deliveries in stories

Use `deliverWebhook` from the separate testing entry point to send a signed body to your running application's real route. It resolves `source.key` through the current Effect Config provider, signs the exact UTF-8 body with GitHub's SHA-256 format by default, and posts it through the `HttpClient` in Effect's environment. It returns the native HTTP response, including refusal responses. Your kit supplies the client and configuration, waits for the application's workers, and exposes their results for the spec to assert. The helper has no test-story dependency.

```ts
import { FetchHttpClient } from "effect/http";
import { deliverWebhook } from "@shivaedev/webhooks/server/testing.ts";

const response = yield* deliverWebhook({
	url: `${appUrl}/webhooks/github`,
	source: sources.github,
	body: JSON.stringify({ issue: { number: 42 } }),
	headers: {
		"x-github-delivery": "story-issue-42",
		"x-github-event": "issues",
	},
}).pipe(Effect.provide(FetchHttpClient.layer));
const answer = yield* response.text;
```

`appUrl` is the kit's running host URL, and `sources` is the application's registration above. Header overrides apply after signing: set `"x-hub-signature-256"` to a wrong signature to exercise refusal, or to `null` to omit it. The helper accepts raw strings so stories can also send signed malformed JSON.

For a different signature format, pass `sign: (body, key) => Effect.succeed(headers)`, returning that provider's signed headers. The callback receives the resolved redacted secret; its typed errors and service requirements remain in the delivery Effect. A timestamp-aware signer can close over a stale timestamp and sign it together with the body to exercise the application's expiry policy. GitHub's own strategy does not check timestamps. Production routes do not import the testing entry point.

Applications install `@shivaedev/platform` and import this package by name. Libraries can install `@shivaedev/webhooks` directly with the Effect, Node HTTP and pg-boss peers used by their host. The stories run against `PLATFORM_JOBS_TEST_DATABASE_URL`, using real HTTP and isolated PostgreSQL databases.
