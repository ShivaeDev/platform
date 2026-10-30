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

A source has a name, a verification strategy, a signing key loaded through Effect Config, and event registrations. Strategies read delivery identity and event names from headers and verify the raw bytes before JSON decoding. Event schemas describe only the fields your application needs; the mapping returns typed job requests. No worker handler runs in the route.

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
| Database or enqueue failure                | 503    | Empty              |

Refused requests create no receipt and no jobs. Signatures are checked before decoding; unlisted events are verified and recorded without decoding. The signing key, signature and raw body stay out of responses, logs and spans.

Database and enqueue failures log their redacted cause and `errorTag` at error level before the empty 503 response. The HTTP request span records the redacted failure with its original tag. Receiving a delivery runs under the `Webhooks.receive` span.

The receipt insert and every enqueue use one SQL transaction. Concurrent copies wait on the receipt's unique key: a committed first copy makes the second a duplicate; a rolled-back first copy lets the second receive the delivery itself. If any enqueue fails, earlier enqueues and the receipt roll back, and the sender's retry can succeed. Receipts for ignored events are deduplicated too.

### Other senders

`githubSource` supplies `githubStrategy`, which checks `X-Hub-Signature-256` through `@shivaedev/github` and reads `X-GitHub-Delivery` and `X-GitHub-Event`. Each key is a `Config.Config<Redacted.Redacted<string>>` and is resolved when the route Layer starts.

For another sender, supply a `WebhookSource` from `registration.ts` with its own `WebhookStrategy`. Its `verify(body, headers, key)` returns an Effect that fails with `WebhookUnauthorized` from `WebhookUnauthorized.ts` for invalid signatures. Its `delivery(headers)` returns `{ id, event }`; neither field comes from the payload. The route, receipts and queue mapping stay the same.

Applications install `@shivaedev/platform` and import this package by name. Libraries can install `@shivaedev/webhooks` directly with the Effect, Node HTTP and pg-boss peers used by their host. The stories run against `PLATFORM_JOBS_TEST_DATABASE_URL`, using real HTTP and isolated PostgreSQL databases.
