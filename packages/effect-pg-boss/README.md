# @shivaedev/effect-pg-boss

Run PostgreSQL jobs through the same Effect services as the rest of your application. A queue has one payload Schema for enqueueing and handling, and an Effect Layer owns the pg-boss client, workers and schedules.

## Why you want this

A background worker lives outside the request that queued it. Without a shared boundary, the producer writes one payload shape, the worker assumes another, and every worker rebuilds its dependencies and shutdown plumbing. This package puts those decisions in one place:

```ts
import { defineQueue } from "@shivaedev/effect-pg-boss/definition.ts";
import { Effect, Schema } from "effect";
import { Mail } from "./services.ts";

const SendEmail = defineQueue({
  name: "send-email",
  schema: Schema.Struct({ userId: Schema.NumberFromString }),
});

const emailWorker = SendEmail.handle(({ userId }) =>
  Effect.flatMap(Mail, (mail) => mail.send(userId)),
);
```

`Mail` is the application's Effect service, defined in the guide below. The worker receives a number even though the durable payload stores a string. The same Schema encodes the producer's payload and decodes the worker's input; malformed stored data fails before the handler runs. Provide the worker's services when the jobs Layer starts, and the handler uses that captured context when pg-boss calls it later.

## Using it

### How to think about it

A **queue definition** names a pg-boss queue and the Schema of its payload. Application code uses the Schema's decoded type; pg-boss receives its encoded type. Both must be objects. Defining a queue describes the contract; `queue.handle(handler)` pairs it with the Effect that performs the work.

A **schedule definition** describes a queue with a cron trigger. `schedule.run(effect)` pairs it with an Effect that needs no payload. Queue workers and scheduled workers are **registrations**: the values you put in the jobs Layer's `jobs` list.

The application creates one jobs service with `makePgBoss(identifier)`. Its Layer starts a client, registers the job list and captures the services those workers need. The Layer's scope owns its client reference and releases it when the scope ends; the final reference closes the client. Callers use the jobs service to enqueue a decoded payload, look up or retry a job, or read queue health and live counts.

Use a distinct literal identifier for each jobs service. The service and its Layer keep that identifier in their types, so providing a Layer for a different identifier leaves the required jobs service unprovided at compile time.

The work separates naturally: declare the application services once, define a queue and its worker for each feature, provide the complete registration list at the runtime boundary, and enqueue from ordinary application Effects.

### Once per application: the jobs service

Define the application's jobs service and worker dependencies in `services.ts`:

```ts
import { makePgBoss } from "@shivaedev/effect-pg-boss/service.ts";
import { Context, Effect, Layer } from "effect";

export const Jobs = makePgBoss("@app/Jobs");

export class Mail extends Context.Service<Mail, {
  readonly send: (userId: number) => Effect.Effect<void>;
  readonly removeExpired: Effect.Effect<void>;
}>()("@app/Mail") {}

export const MailLive = Layer.succeed(Mail, {
  send: (userId) => Effect.log({ event: "send_email", userId }),
  removeExpired: Effect.log({ event: "remove_expired_mail" }),
});
```

`Jobs` is the service that callers yield. `Mail` is a separate domain service that workers use. The example implementation logs calls so the wiring is complete; an application supplies its own implementation of those methods. The jobs package does not need a provider-specific interface.

### Once per feature: the payload and handler

Define the feature's registrations in `jobs.ts`:

```ts
import { defineQueue, defineSchedule } from "@shivaedev/effect-pg-boss/definition.ts";
import { Effect, Schema } from "effect";
import { Mail } from "./services.ts";

export const SendEmail = defineQueue({
  name: "send-email",
  schema: Schema.Struct({ userId: Schema.NumberFromString }),
  queue: { retryLimit: 5 },
});

export const emailWorker = SendEmail.handle(({ userId }, job) =>
  Effect.gen(function* () {
    const mail = yield* Mail;
    yield* mail.send(userId);
    yield* Effect.log({ jobId: job.id });
  }),
);

export const Cleanup = defineSchedule({
  name: "cleanup-mail",
  cron: "17 3 * * *",
});

export const cleanupWorker = Cleanup.run(
  Effect.flatMap(Mail, (mail) => mail.removeExpired),
);
```

The queue takes `{ userId: number }` in application code and stores `{ userId: string }`. Its handler receives the decoded number and a job context, including the job's `id`. Keep the queue definition available to producers; the runtime registers the worker created by `handle`.

The schedule runs a payload-free Effect. This schedule registers its cron expression with `tz: "UTC"`. The package creates a `<name>-dlq` dead-letter queue for both kinds of worker and supplies `retryLimit: 3` and `retryBackoff: true` by default. The email queue above overrides the retry limit to five. These are pg-boss registration settings; pg-boss runs the retry and scheduling engine.

The Layer requires the workers' Effect services. Leaving `Mail` unprovided leaves that requirement in the resulting Effect's type. A primitive Schema such as `Schema.String` is rejected as a queue definition because the durable contract must be an object.

### Backlog throughput and concurrency

Queue and schedule workers default to `batchSize: 10` and `burstWhenBatchFull: true`. pg-boss fetches again immediately after a full batch completes, until a fetch returns fewer than ten jobs. The adapter runs handlers sequentially within each batch, and pg-boss defaults `localConcurrency` to one. Set native `localConcurrency` to run multiple batches at once:

```ts
const Compare = defineQueue({
  name: "compare",
  schema: Schema.Struct({ id: Schema.Number }),
  queue: { notify: true },
  worker: { batchSize: 2, localConcurrency: 5 },
});
```

This worker runs up to five handlers at once. `worker` accepts pg-boss 12's `WorkOptions`, including `batchSize`, `localConcurrency`, `pollingIntervalSeconds`, `notifyPollingIntervalSeconds` and the burst options. Explicit options override the adapter defaults. pg-boss ignores `burstWhenBatchFull` at `batchSize: 1`; keep a batch size of at least two for immediate backlog draining. Each job is settled separately through pg-boss: success completes that job, and a typed failure, payload decoding failure or defect fails only that job with its own error. A failed job does not spend the retries of other jobs in its batch or rerun their successful handlers. Interruption stops the batch and leaves the interrupted and remaining jobs to pg-boss expiry; handlers must still tolerate repeated side effects across retries and interrupted attempts.

Apps do not need to shorten the polling backstop to drain a backlog. With `notify: true` and an active LISTEN/NOTIFY listener, pg-boss wakes workers on notifications and defaults to a 30-second backstop (`notifyPollingIntervalSeconds`). Without active notifications its base poll defaults to two seconds (`pollingIntervalSeconds`). Bursting takes precedence over both intervals. Override the backstop only when the application needs a different bound for work that becomes runnable without a notification, such as delayed jobs or retries. The PostgreSQL backlog tests insert 30 jobs at once and verify completion within 2.5 seconds with both defaults and configured batches and concurrency.

### Once per runtime: provide the workers

Build the jobs Layer in `runtime.ts`:

```ts
import { Layer } from "effect";
import { cleanupWorker, emailWorker } from "./jobs.ts";
import { Jobs, MailLive } from "./services.ts";

export const jobsLayer = (databaseUrl: string) =>
  Jobs.layer({
    connectionString: databaseUrl,
    schema: "app_jobs",
    jobs: [emailWorker, cleanupWorker],
  }).pipe(Layer.provide(MailLive));
```

The constructor options belong to pg-boss. `jobs` is the complete list of registrations for this Layer. The Layer captures `MailLive` for both the queue handler and the scheduled Effect. A startup or registration failure fails Layer acquisition with `PgBossError` or `PgBossQueueOptionsError` and releases its acquired client reference. A shared client stays running while another scope still owns a reference.

Keep the Layer in the application's worker runtime scope. A short scope is useful for an acquisition or health check; a worker process needs its scope to remain open while it handles jobs.

```ts
import { Effect } from "effect";
import { jobsLayer } from "./runtime.ts";
import { Jobs } from "./services.ts";

const inspectJobs = (databaseUrl: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      const jobs = yield* Jobs;
      return yield* jobs.health;
    }).pipe(Effect.provide(jobsLayer(databaseUrl))),
  );
```

This Effect starts the jobs Layer, reads health and closes the scope. The client stops when that scope closes.

### In application code: enqueue

```ts
import { Effect } from "effect";
import { SendEmail } from "./jobs.ts";
import { Jobs } from "./services.ts";

export const enqueueEmail = (userId: number) =>
  Effect.gen(function* () {
    const jobs = yield* Jobs;
    return yield* jobs.enqueue(SendEmail, { userId });
  });
```

Provide `Jobs` through the application's existing runtime. `enqueue` takes the decoded payload, so passing a string `userId` is a type error. It encodes the number to a string before calling pg-boss. The result type is `Option.Option<string>`: a job identifier becomes `Some`, and a `null` send result becomes `None`.

`PgBossPayloadError` names a payload boundary failure; malformed durable input is rejected before the worker's domain code runs. The PostgreSQL test also checks that invalid data sent directly to pg-boss reaches the dead-letter queue without reaching the handler.

### Trace jobs

Each queue or scheduled job attempt runs in one root consumer span named for its queue. The span encloses payload decoding and the whole handler, so top-level `Effect.fn` steps are children of the job span. Its attributes include `job.id`, `job.queue`, `job.name`, the one-based `job.attempt` and pg-boss's zero-based `job.retry_count`. A failed handler ends the span with its failure.

`enqueue` captures the current Effect span, including an external parent span, when present. It stores that context in a typed envelope in pg-boss's existing job `data`; the adapter unwraps the envelope before Schema decoding in the handler and `getJob`, so the application's payload Schema stays unchanged. Jobs sent without a span keep their ordinary encoded payload, and workers also accept those unwrapped jobs. Direct pg-boss data readers see the envelope for traced sends.

The consumer span links to the sender rather than sharing its parent trace, following OpenTelemetry messaging conventions for asynchronous processing. Each retry gets its own job trace. Provide the application's Effect tracer when building the worker Layer; the worker uses that captured tracer. The PostgreSQL tracing tests use Effect's in-memory tracer and a producer that shuts down before its worker starts; the scheduled-worker test checks the same span boundary with a fake client.

### Read health

```ts
import { Effect } from "effect";
import { Jobs } from "./services.ts";

export const readJobCounts = Effect.gen(function* () {
  const jobs = yield* Jobs;
  const health = yield* jobs.health;
  return {
    active: health.activeTotal,
    deadLettered: health.deadLetteredTotal,
    failed: health.failedTotal,
    queued: health.queuedTotal,
    ready: health.readyTotal,
  };
});
```

`health` exposes pg-boss cached queue counts as data. It stays cheap and follows the pg-boss monitor interval; it does not establish that a queue has just drained. Its total fields include the registered queue's active, failed, queued and ready counts, plus the dead-letter queue's queued count. Decide in the application which values affect an HTTP health response or an alert.

### Read live counts and retry a job

```ts
import { Effect, Option } from "effect";
import { SendEmail } from "./jobs.ts";
import { Jobs } from "./services.ts";

export const inspectEmail = (id: string) => Effect.gen(function* () {
  const jobs = yield* Jobs;
  const job = yield* jobs.getJob(SendEmail, id);
  if (Option.isSome(job) && job.value.state === "failed") {
    yield* jobs.retry(SendEmail, id);
  }
  const counts = yield* jobs.counts(SendEmail);
  return counts.queuedCount === 0 && counts.activeCount === 0;
});
```

`counts(queue)` reads the job table directly on each call. `queuedCount` includes created and retry-waiting jobs, including future jobs; `activeCount` counts running jobs, `failedCount` counts retained failures, and `totalCount` includes retained terminal jobs. A queue has drained when queued and active counts are both zero. These counts are a snapshot, so a producer can enqueue more work after the query returns.

`getJob(queue, id)` returns `None` when the ID is absent, or `Some` pg-boss job metadata with `data` decoded by the queue's Schema. Invalid stored data fails with `PgBossPayloadError`, and the Effect requires the Schema's decoding services. `retry(queue, id)` reuses the original ID: it makes a failed job eligible for another attempt and pulls a retry-waiting job forward to run now. Missing IDs and jobs in other states are left unchanged. It does not remove an earlier copy from the dead-letter queue.

### Queue settings on startup

`queue` accepts pg-boss `Queue` options except `name` and `deadLetter`, which the definition and adapter own. For prompt delivery, set `queue: { notify: true }` and enable `useListenNotify: true` in the worker Layer's constructor options. The PostgreSQL notification test waits for an idle worker with a ten-second polling interval and verifies delivery within 1.5 seconds.

Startup creates missing queues and reconciles declared settings on existing queues through `updateQueue`. Unspecified settings keep their stored values; the adapter always supplies its default retry settings and dead-letter destination. Changing an explicitly declared `policy` or `partition` on an existing queue fails startup with `PgBossQueueOptionsError`; its `queue`, `options` and message identify the conflict. Queue setting changes apply to subsequently enqueued jobs. Schedule queues follow the same registration path.

### Share a client between Layer builds

```ts
import { Layer } from "effect";
import { cleanupWorker, emailWorker } from "./jobs.ts";
import { Jobs, MailLive } from "./services.ts";

const sharedJobsLayer = (databaseUrl: string) =>
  Jobs.layer({
    connectionString: databaseUrl,
    schema: "app_jobs",
    clientCacheKey: "app-jobs",
    jobs: [emailWorker, cleanupWorker],
  }).pipe(Layer.provide(MailLive));
```

Overlapping Layer builds with the same `clientCacheKey` share one started client. The later build replaces the registered worker, and the final scope release stops the shared client. A later build after that release starts a new client. Without a key, each build creates its own client. The application chooses whether to pass a key.

### Separate producers and workers

Pass a queue definition directly in the jobs Layer to create its queue and dead-letter queue without starting a consumer:

```ts
import { SendEmail } from "./jobs.ts";
import { Jobs } from "./services.ts";

export const producerLayer = (databaseUrl: string) =>
  Jobs.layer({ connectionString: databaseUrl, jobs: [SendEmail] });
```

Provide this Layer to the request runtime and call `jobs.enqueue(SendEmail, { userId })` as above. A separate worker process registers `SendEmail.handle(...)` against the same database. Producer queues use the same retry options and appear in `health`; only worker registrations capture handler services. The PostgreSQL producer test creates both queues through this Layer, enqueues a transformed payload, and observes a failing worker exhaust two retries before the job reaches its dead-letter queue.

### Enqueue follow-ups from a handler

A handler can yield the same `Jobs` service that owns it. The Layer supplies that service from its scoped client; other handler and Schema service requirements remain required inputs to the Layer.

```ts
const Receipt = defineQueue({
  name: "receipt",
  schema: Schema.Struct({ userId: Schema.Number }),
});

const sendAndQueueReceipt = SendEmail.handle(({ userId }) =>
  Effect.gen(function* () {
    const mail = yield* Mail;
    yield* mail.send(userId);
    const jobs = yield* Jobs;
    yield* jobs.enqueue(Receipt, { userId });
  }),
);

const live = Jobs.layer({
  connectionString: databaseUrl,
  jobs: [sendAndQueueReceipt, Receipt],
}).pipe(Layer.provide(MailLive));
```

Include every target queue in `jobs`, as either a worker or a producer-only definition. Startup creates all queues before starting consumers. The example registers `Receipt` for another process to consume. A follow-up target can also have a worker in the same Layer. Scheduled effects can yield `Jobs` too. Keep one jobs Layer in the process's native Layer graph; that Layer owns one client for enqueueing and handling. The PostgreSQL follow-up test completes a chain across two workers, enqueues to a producer-only queue and asserts one client acquisition and shutdown.

### API

Import the module that defines the name; the package has no root entry.

| Module | Public names |
| --- | --- |
| `@shivaedev/effect-pg-boss/definition.ts` | `defineQueue`, `defineSchedule`, `jobContext`; `DefineQueueOptions`, `DefineScheduleOptions`, `JobContext`, `JobPayloadSchema`, `JobRegistration`, `QueueDefinition`, `QueueWorker`, `RegistrationRequirements`, `ScheduleDefinition`, `ScheduledWorker` |
| `@shivaedev/effect-pg-boss/service.ts` | `makePgBoss`; `PgBossDefinition`, `PgBossLayerOptions`, `PgBossService` |
| `@shivaedev/effect-pg-boss/health.ts` | `deadLetterQueueName`; `JobsHealth`, `QueueCounts`, `QueueHealth` |
| `@shivaedev/effect-pg-boss/error.ts` | `PgBossError`, `PgBossPayloadError`, `PgBossQueueOptionsError`, `toPgBossError`; `PgBossOperation` |
| `@shivaedev/effect-pg-boss/client.ts` | `defaultClientFactory`; `PgBossClient`, `PgBossClientFactory` |

The definition options keep the pg-boss names: `queue` uses `Queue` except `name` and `deadLetter`, `worker` uses `WorkOptions`, and a schedule's `schedule` uses `ScheduleOptions`. A queue also requires `name` and `schema`; a schedule requires `name` and `cron`.

The application's service has these operations:

- `enqueue(queue, payload, options?)`: an Effect returning `Option.Option<string>`, with `PgBossError | PgBossPayloadError` in its error type. Its options use pg-boss `SendOptions`.
- `health`: an Effect returning cached `JobsHealth`, with `PgBossError` in its error type.
- `counts(queue)`: an Effect returning live `QueueCounts`, with `PgBossError` in its error type.
- `getJob(queue, id)`: an Effect returning `Option.Option<JobWithMetadata<Payload>>` with decoded payload data, `PgBossError | PgBossPayloadError` in its error type and the Schema's decoding services in its requirements.
- `retry(queue, id)`: an Effect returning `void`, with `PgBossError` in its error type.

`Jobs.layer(options)` accepts pg-boss `ConstructorOptions` plus `jobs`, optional `clientCacheKey`, optional `clientFactory`, optional `onError` and optional `stop`. The factory type accepts constructor options and returns `PgBossClient`. Custom clients must supply native `complete` and `fail` capabilities to register queue or schedule workers; missing settlement capabilities fail Layer acquisition with a registration `PgBossError`. Producer-only clients do not need them. Custom clients can also supply the optional native capabilities `findJobs`, `retry`, `update`, `getDb` and `updateQueue` for lookup, retry, live counts and reconciliation; a requested operation fails with `PgBossError` if its required capability is absent. `onError` has the type `(error: Error) => Effect.Effect<unknown, never, R>`; `stop` uses pg-boss `StopOptions`.

`onError` handles pg-boss client `error` events using the services captured by the Layer. The Layer's requirement type includes the workers' services and their payload Schemas' `DecodingServices`, excluding its own jobs identifier, plus the callback's services. Only the owning jobs service is supplied automatically; a handler using another jobs definition still requires that definition's Layer. `enqueue` includes the payload Schema's `EncodingServices` in its requirement type.

`JobContext` has `id`, `name`, `signal`, `expireInSeconds` and `heartbeatSeconds`. `QueueHealth` has `name`, `activeCount`, `deadLetteredCount`, `failedCount`, `queuedCount` and `readyCount`. `JobsHealth` has `jobs` and the corresponding `activeTotal`, `deadLetteredTotal`, `failedTotal`, `queuedTotal` and `readyTotal` fields.

`PgBossError` has `operation`, optional `queue` and a `Redacted` `original`. `PgBossPayloadError` has `direction`, `queue` and a `Redacted` `original`. Those fields distinguish the pg-boss operation from the payload boundary.

### Install, setup and limits

```sh
pnpm add @shivaedev/effect-pg-boss effect@4.0.4 pg-boss@12.37.0
```

The package requires Node.js 24 or later and PostgreSQL. `effect` and `pg-boss` are peers; use versions that satisfy the package's published peer ranges.

Provide the database connection and job registrations at the application runtime boundary. Application services own the domain work and provider calls; pg-boss owns queue execution. Treat enqueueing and an application database transaction as separate operations. Enqueue after the application write commits, and handle queue failures in the application so they cannot roll back the write. The starter logs enqueue failures and returns the saved note; a failed enqueue leaves its word count pending. The package supplies no application transaction adapter.

For package development, the real PostgreSQL test uses `PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL` and skips when the variable is absent. A skipped test does not establish durable queue behavior. Fake-client tests cover registration and lifecycle calls; they do not establish real cron execution, retry timing or deployment behavior. The package is built for ShivaeDev applications and may change without a deprecation period.

The [north star](./docs/north-star.md) explains the design trade-offs; the [roadmap](./docs/roadmap.md) owns package work and open choices.
