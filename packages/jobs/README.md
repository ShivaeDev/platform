# @shivaedev/jobs

Run PostgreSQL jobs through the same Effect services as the rest of your application. A queue has one payload Schema for enqueueing and handling, and an Effect Layer owns the pg-boss client, workers and schedules.

## Why you want this

A background worker lives outside the request that queued it. Without a shared boundary, the producer writes one payload shape, the worker assumes another, and every worker rebuilds its dependencies and shutdown plumbing. This package puts those decisions in one place:

```ts
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
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

The application creates one jobs service with `makePgBoss(identifier)`. Its Layer starts a client, registers the job list and captures the services those workers need. The Layer's scope owns its client reference and releases it when the scope ends; the final reference closes the client. Callers use the jobs service to enqueue a decoded payload, look up or retry a job, read queue health and live counts, or list failed and dead-lettered jobs.

Use a distinct literal identifier for each jobs service. The service and its Layer keep that identifier in their types, so providing a Layer for a different identifier leaves the required jobs service unprovided at compile time.

The work separates naturally: declare the application services once, define a queue and its worker for each feature, provide the complete registration list at the runtime boundary, and enqueue from ordinary application Effects.

### Once per database: install the schema

For an application on the app host of `@shivaedev/server`, register `pgBossSchema` beside the migration loader. The host's `migrate` mode installs or upgrades it after committing the application ledger. Its `check` and `wait` modes include pg-boss readiness in the same check as the numbered migrations.

```ts
import { pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import { appDatabase } from "@shivaedev/server/appHost.ts";

const database = appDatabase({
  migrations: {
    loader,
    components: [pgBossSchema({ schema: "app_jobs" })],
    mode: "migrate",
  },
});
```

The component uses `installPgBossSchema` as its only install and upgrade path. It is pending when the schema is missing or its stored version is below the installed pg-boss package's required schema version; the readiness error names the schema and both versions (`missing` for an absent version). Start every producer and worker with the same schema and `migrate: false`. Use host mode `"wait"` for services that must wait for a deployment's migration process; no additional jobs-layer wait is needed.

With server's `appDatabase({ migrations: { mode: "wait", release, ... } })`, each jobs Layer automatically reads sql's optional `WorkerRelease` Context service. When the database belongs to another release, it calls pg-boss `offWork` for every registered worker queue, lets active jobs finish, logs `Workers paused for another database release` once, and idles. Producers and enqueueing continue. When its release owns the marker again and old workers have drained, it registers workers through the normal path and logs `Workers resumed for database release`. Equality permits rollbacks; no version ordering or payload compatibility policy is added. With no service, registration behaves as before.

A worker keeps its sql heartbeat row live while draining; the owning release waits for all other live releases to step aside. A crashed worker stops blocking once its heartbeat is older than five polling intervals. Set an explicit queue `expireInSeconds` and a `stop: { graceful: true, timeout }` long enough to cover it. Scope shutdown on SIGTERM waits for the native pg-boss stop before releasing application dependencies. Give the host's termination grace a margin beyond that timeout; the starter uses 60-second expiry, 65-second stop and 75-second Railway draining.

`installPgBossSchema` installs or upgrades pg-boss through the provided Effect SQL client without starting workers or schedules. Run it outside an application transaction, in a release step or the `fixtures` Effect of `makePostgresTestLayer`, so stories inherit the schema from the migrated template:

```ts
import { installPgBossSchema } from "@shivaedev/jobs/server/schema.ts";

const jobsFixture = installPgBossSchema({ schema: "app_jobs" });
```

The Effect requires `SqlClient` and fails with `PgBossError` whose `operation` is `"install"`. The schema defaults to `"pgboss"`. Repeating installation preserves existing jobs. Upgrades apply pg-boss's migration SQL and concurrent index builds, including partition indexes, before returning. Pending index commands are recorded in pg-boss's BAM table in the same transaction as the schema version. A retry resumes unfinished commands and repairs invalid indexes left by failed builds, even when the schema version has already committed.

After installation, pass the same schema and `migrate: false` to `Jobs.layer` to start producers and workers without schema installation or migration. Startup fails if the schema is missing. Ordinary Layer startup retains pg-boss's default migration behavior when `migrate` is omitted.

### Once per application: the jobs service

Define the application's jobs service and worker dependencies in `services.ts`:

```ts
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
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
import { defineQueue, defineSchedule } from "@shivaedev/jobs/server/definition.ts";
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

Apps do not need to shorten the polling backstop to drain a backlog. With `notify: true` and an active LISTEN/NOTIFY listener, pg-boss wakes workers on notifications and defaults to a 30-second backstop (`notifyPollingIntervalSeconds`). Without active notifications its base poll defaults to two seconds (`pollingIntervalSeconds`). Bursting takes precedence over both intervals. After an adapter worker fails a job, it reads pg-boss's stored retry time and schedules a wake for every native worker in its registration at that time, so an idle sibling can retry while another worker is busy. The wake belongs to the worker Layer's scope and is canceled when that scope closes. Override the backstop when the application needs a different bound for other work that becomes runnable without a notification, such as delayed jobs or retries initiated outside the adapter worker.

### Defer until a provider is ready

Fail a queue handler or scheduled Effect with `RetryAt` when a provider gives a time to try again:

```ts
import { DateTime, Effect } from "effect";
import { RetryAt } from "@shivaedev/jobs/server/definition.ts";

const waitForQuota = Effect.fail(new RetryAt({
  at: DateTime.makeUnsafe("2030-01-01T00:01:00Z"),
  reason: "Provider quota resets",
}));
```

The same job returns to waiting with `startAfter` set to `at`; its ID, singleton key, payload and retry count stay unchanged. A past or current `at` is eligible on the next fetch. Deferral does not dead-letter the job or call `onError`. Its job span ends OK with a `job.deferred` event whose `at` is an ISO UTC string and whose `reason` is the supplied string. Deferred jobs rely on polling, including queues using `notify: true`. Stately jobs sharing a singleton key can defer together and still run one at a time. While waiting, their native job metadata reports the adapter's `effect-stately-deferred` policy; a database trigger restores `stately` when pg-boss claims them, preserving its active-job exclusion.

Set `queue: { maxDeferrals: 20 }` on a queue or schedule to change the default limit of ten deferrals per job. The limit must be a nonnegative safe integer; zero disables deferral. Once the limit is reached, `RetryAt` follows the normal failure and retry path. The adapter stores the count in its own table in the pg-boss schema, preserving it across worker restarts, ordinary failures, expiry and heartbeat timeouts. Automatic migrations and `installPgBossSchema` create this table and the stately claim trigger; use `installPgBossSchema` before starting workers with `migrate: false`.

### One active job per entity

Put related job kinds in one tagged-union queue and choose the entity key in the definition:

```ts
const PullRequestJobs = defineQueue({
  name: "pull-request",
  schema: Schema.Union([
    Schema.TaggedStruct("Refresh", { pullRequestId: Schema.NumberFromString }),
    Schema.TaggedStruct("Reconcile", { pullRequestId: Schema.NumberFromString }),
  ]),
  queue: { policy: "singleton" },
  key: ({ pullRequestId }) => `pr:${pullRequestId.toFixed(0)}`,
  worker: { batchSize: 1, localConcurrency: 3 },
});

const refresh = Effect.flatMap(Jobs, (jobs) =>
  jobs.enqueue(PullRequestJobs, { _tag: "Refresh", pullRequestId: 42 }),
);
```

`queue.policy` accepts pg-boss's policy literals and rejects typos. The `singleton` policy requires `key: (payload) => string`. The callback sees the decoded payload, so `pullRequestId` is a number. `enqueue` supplies pg-boss's `singletonKey` automatically; callers cannot supply a conflicting key in send options.

PostgreSQL guarantees one active job per key across workers, including different job kinds in this queue. Different keys can run in parallel when workers have capacity. A job waiting to retry frees its key for another job; exhausting retries sends it to the dead-letter queue and leaves the key available.

Singleton guarantees one active job per key, not order. Ordering stays the application's job. Keep handlers idempotent and write state only when the source is newer than what is stored, so an older event or retry cannot overwrite newer state.

### Size batches against expiry

pg-boss marks every job in a fetched batch active together. Each job's expiry window starts at its stored `startedOn`, including time waiting for earlier handlers. Size each queue's batch so its sequential work fits within that window; use a small batch for long-running work and keep the default for short work:

```ts
const Ingest = defineQueue({
  name: "ingest",
  schema: Schema.Struct({ sourceId: Schema.String }),
  queue: { expireInSeconds: 300 },
  worker: { batchSize: 1 },
});

const IndexTitle = defineQueue({
  name: "index-title",
  schema: Schema.Struct({ titleId: Schema.String }),
});
```

`Ingest` fetches one job at a time; `IndexTitle` keeps the default batch of ten. Configure the expiry for the work's expected duration. Increasing `localConcurrency` adds batches; it does not extend any job's window.

The adapter enforces each queue or scheduled job's deadline using pg-boss's `startedOn` and `expireInSeconds`. It skips jobs whose window has already passed and interrupts a running Effect at its deadline. Expired jobs remain for pg-boss's expiry and retry engine. Interruption stops the rest of that batch, as described above.

An interrupted batch waits for pg-boss to release its original claims before returning successfully. Settlement reads use exponential backoff from 25 ms to 500 ms between reads, with a bound of one second after the latest fetched job's deadline, including a read that never resolves. If settlement cannot be observed within that bound, the callback fails with `PgBossError` (`operation: "settle"`, with a redacted `TimeoutError`) and logs the error through the worker's captured Effect context.

Queue handlers can yield `job.remainingBudget`, an `Effect.Effect<Duration.Duration>` that recomputes the time left at each read and clamps it to zero. Use it to size a downstream operation's timeout:

```ts
import { Duration, Effect } from "effect";

const ingestWorker = Ingest.handle(({ sourceId }, job) =>
  Effect.gen(function* () {
    const budget = yield* job.remainingBudget;
    yield* Effect.log({ sourceId, remainingMilliseconds: Duration.toMillis(budget) });
  }),
);
```

Keep handler work interruptible and use cancellation-aware Effect integrations for external operations. A deadline interrupts the Effect fiber; it cannot stop an uninterruptible region or an external side effect that ignores cancellation. Handlers must tolerate retries.

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

The constructor options belong to pg-boss. `jobs` is the complete list of registrations for this Layer. The Layer captures `MailLive` for both the queue handler and the scheduled Effect. A startup or registration failure fails Layer acquisition with `PgBossError` or `PgBossQueueOptionsError` and releases its acquired client reference. Registration creates a queue again, up to six times with a short backoff, when PostgreSQL rolls the creation back as a deadlock victim (SQLSTATE `40P01`), which a partitioned queue can meet when other queues in the schema have traffic. A shared client stays running while another scope still owns a reference.

Keep the Layer in the application's worker runtime scope. A short scope is useful for an acquisition or health check; a worker process needs its scope to remain open while it handles jobs.

Set `clientCacheKey` to share one reference-counted client across Layer builds with equal pg-boss constructor settings. Reusing a key with different settings fails acquisition with `PgBossClientOptionsError` before constructing another client. Its `key`, `options` and message identify the key and differing option names without exposing connection values. Nested options are compared by value.

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

`PgBossPayloadError` names a payload boundary failure; malformed durable input is rejected before the worker's domain code runs.

### Trace jobs

Each queue or scheduled job attempt runs in one root consumer span named for its queue. The span encloses payload decoding and the whole handler, so top-level `Effect.fn` steps are children of the job span. Its attributes include `job.id`, `job.queue`, `job.name`, the one-based `job.attempt` and pg-boss's zero-based `job.retry_count`. A failed handler ends the span with its failure.

`enqueue` captures the current Effect span, including an external parent span, when present. It stores that context in a typed envelope in pg-boss's existing job `data`; the adapter unwraps the envelope before Schema decoding in the handler and `getJob`, so the application's payload Schema stays unchanged. Jobs sent without a span keep their ordinary encoded payload, and workers also accept those unwrapped jobs. Direct pg-boss data readers see the envelope for traced sends.

The consumer span links to the sender rather than sharing its parent trace, following OpenTelemetry messaging conventions for asynchronous processing. Each retry gets its own job trace. Provide the application's Effect tracer when building the worker Layer; the worker uses that captured tracer.

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

### List failed and dead-lettered jobs

```ts
import { Effect, Option } from "effect";
import { SendEmail } from "./jobs.ts";
import { Jobs } from "./services.ts";

export const failedEmails = (cursor?: string) => Effect.gen(function* () {
  const jobs = yield* Jobs;
  const failed = yield* jobs.failedJobs(SendEmail, { cursor, limit: 20 });
  const deadLettered = yield* jobs.deadLetteredJobs(SendEmail, { limit: 20 });
  return {
    deadLettered: deadLettered.jobs.map((job) => ({ id: job.id, original: Option.getOrNull(job.sourceId), error: job.sourceOutput })),
    failed: failed.jobs.map((job) => ({ id: job.id, attempt: job.attempt, error: job.output, userId: job.data.userId })),
    next: Option.getOrUndefined(failed.next),
  };
});
```

`health` and `counts` say how many jobs failed; these two listings say which ones and why. `failedJobs(queue, options)` lists the queue's jobs in the `failed` state, the ones that used up their retries. `deadLetteredJobs(queue, options)` lists every job in the queue's dead-letter queue. Dead-letter entries live in the `-dlq` queue: each is a new job with its own ID that pg-boss copied there when the original failed for good. Both listings read pg-boss's `job` table on each call, through the jobs Layer's own pg-boss connection and in its configured schema, so applications never query pg-boss tables themselves. A custom client needs the native `getDb` capability for them.

Each page holds at most `limit` jobs, newest first by creation time; a dead-letter copy is created when its original fails for good. `limit` must be a positive integer. When more jobs remain, `next` is `Some` opaque cursor; pass it back as `cursor` for the following page, and stop when `next` is `None`. Paging continues from the last job it returned, so jobs that fail while you page appear in a fresh listing instead of shifting later pages, and no job appears twice. A malformed cursor or limit fails with `PgBossError` whose `operation` names the listing.

An entry carries the job's `id`, `queue`, native `state`, `retryCount`, `retryLimit` and `attempt`, the one-based number of its last started attempt (zero for a job that never started). `createdOn` is a UTC `DateTime`; `startedOn` and `completedOn` are `Option`s of UTC `DateTime`s. `output` is the job's stored output as pg-boss recorded it: for a failed job, the error its last attempt failed with, and `null` when pg-boss stored none. `data` is decoded by the queue's Schema, including traced payloads; invalid stored data fails the listing with `PgBossPayloadError`, as `getJob` does, and the Effect requires the Schema's decoding services. A dead-letter entry adds `sourceId`, the original job's ID as an `Option`, and `sourceOutput`, the error the original failed with. The copy has not run, so its own `output` stays `null` and its `attempt` is zero.

Pass a failed entry's `id` to `retry(queue, id)` to run that job again under its original ID; once it completes it leaves the failed listing. Dead-letter IDs belong to the `-dlq` queue, so `retry(queue, id)` does not find them and leaves them unchanged.

### Queue settings on startup

`queue` accepts pg-boss `Queue` options except `name` and `deadLetter`, which the definition and adapter own, plus the adapter’s `maxDeferrals` limit. For prompt delivery, set `queue: { notify: true }` and enable `useListenNotify: true` in the worker Layer's constructor options.

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

Overlapping Layer builds with the same `clientCacheKey` share one started client. The later build replaces the registered worker, and the final scope release stops the shared client. A later build after that release starts a new client. Without a key, each build creates its own client. The application chooses whether to pass a key; give each distinct constructor configuration its own key.

### Separate producers and workers

Pass a queue definition directly in the jobs Layer to create its queue and dead-letter queue without starting a consumer:

```ts
import { SendEmail } from "./jobs.ts";
import { Jobs } from "./services.ts";

export const producerLayer = (databaseUrl: string) =>
  Jobs.layer({ connectionString: databaseUrl, jobs: [SendEmail] });
```

Provide this Layer to the request runtime and call `jobs.enqueue(SendEmail, { userId })` as above. A separate worker process registers `SendEmail.handle(...)` against the same database. Producer queues use the same retry options and appear in `health`; only worker registrations capture handler services.

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

Include every target queue in `jobs`, as either a worker or a producer-only definition. Startup creates all queues before starting consumers. The example registers `Receipt` for another process to consume. A follow-up target can also have a worker in the same Layer. Scheduled effects can yield `Jobs` too. Keep one jobs Layer in the process's native Layer graph; that Layer owns one client for enqueueing and handling.

### Test through the queue contract

`testing.ts` gives story kits a controller for one real pg-boss client. Create a fresh controller per runtime, pass its `clientFactory` to the jobs Layer, and keep that Layer scoped as usual. `jobs(queue, options?)` returns native job metadata with `data` decoded through the queue's Schema, including traced payloads. Invalid durable data fails with `PgBossPayloadError`; decoding services remain in the Effect's requirements.

This producer story uses the `SendEmail` definition and `Jobs` service from above. `databaseUrl` points to the story's PostgreSQL database:

```ts
import { Context, Layer, Option } from "effect";
import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makePgBossTesting, testRetryPolicy } from "@shivaedev/jobs/server/testing.ts";

const emailStories = storyKit({
  clock: "live",
  *create() {
    const testing = makePgBossTesting({ retryPolicy: testRetryPolicy });
    const context = yield* Layer.build(Jobs.layer({
      connectionString: databaseUrl,
      clientFactory: testing.clientFactory,
      jobs: [SendEmail],
    }));
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
  expect(yield* testing.jobs(SendEmail)).toMatchObject([
    { id, data: { userId: 42 }, state: "created" },
  ]);
});
```

Set `retryPolicy: testRetryPolicy` through the controller to override queue and send settings with `retryDelay: 0` and `retryBackoff: false`. A failing worker can then exhaust its native retries without production backoff. The policy applies to subsequently sent jobs; it does not rewrite jobs already stored.

`failNextSend(queue)` arms one send failure for that queue. The next valid `enqueue` fails with the usual typed `PgBossError` (`operation: "enqueue"`); the following send proceeds normally.

`expireAfter(queue, n)` takes a positive attempt count: configure it before enqueueing to limit subsequent jobs to `n` attempts. Each successful send keeps its own expiry rule; later changes and duplicate-ID sends do not alter pending jobs. Earlier attempts run the handler normally; on attempt `n`, the controller expires the claimed job instead of invoking its handler. PostgreSQL supervision performs the terminal failure and dead lettering. A job that succeeds earlier completes normally.

`expireIn(queue, duration)` takes an Effect `Duration.Input`, such as `"1 second"`, and sets the expiry of subsequent sends, rounded up to whole seconds. Durations below one second or nonfinite durations fail with `PgBossTestingError` (`operation: "expireIn"`). Earlier sends retain their expiry, and later calls and duplicate-ID sends do not change stored jobs. It can be combined with `expireAfter`: one sets each attempt's time budget, the other limits attempts. A stuck handler is interrupted at its deadline, and the same worker can fetch its retry after pg-boss fails the attempt. The testing expiry hooks support pg-boss schema version 46.

`deferred(queue)` returns waiting deferrals as `{ at: DateTime.Utc, reason: string }[]`. `runDeferredNow(queue)` pulls those jobs forward to the database’s current time and wakes local workers without waiting for their original due time. Read `revision` before reading deferrals and use `waitForChange(revision)` as with other controls.

`checkBatchWindow(queue, millisecondsPerJob)` checks that the declared sequential batch fits strictly inside the stored queue expiry window. `schemaVersion` reads the installed version, and `checkSchemaVersion(expected)` fails when it differs. Test control, read and check failures use `PgBossTestingError` with `operation`, optional `queue` and a redacted `original`.

`snapshot(queues)` reads the unfinished jobs of several queues in one query, so the result is one consistent PostgreSQL snapshot. It returns jobs in the `created`, `retry`, `active` and `failed` states, never completed ones, oldest first by creation. Each entry has the job's `id`, `queue` (the definition's name), `state`, `startAfter` as a UTC `DateTime` and `data` decoded by that queue's Schema. Only unfinished rows are decoded, so a completed job whose stored data the Schema no longer accepts does not fail the read; invalid unfinished data fails with `PgBossPayloadError`.

`waitForIdle` completes when the controller's local workers hold no job in flight and none of their queues has a job ready to fetch. A job is in flight while it is active in a local worker's queue. A terminal native worker timeout lets the wait complete after pg-boss fails the job. A job whose `startAfter` is in the future does not hold the wait open, and neither do queues without a local worker. While a fetched batch has no settlement yet, the wait reads nothing and waits for the next local change; otherwise it checks with one query per change. A kit settles by yielding `waitForIdle` and then reading jobs once.

A kit can also capture `revision` before reading jobs and yield `waitForChange(revision)` when its condition is unmet. The wait resumes after a local send, settlement or worker fetch, and when a local worker returns to idle as `waitForIdle` defines it, including terminal native worker timeouts. It also resumes immediately if a change occurred between the read and the wait. This signal observes the controller's client; external clients, future scheduled work and external database writes need their own wake source. Stories should retain a bounded test timeout.

### API

Import the module that defines the name; the package has no root entry.

| Module | Public names |
| --- | --- |
| `@shivaedev/jobs/server/definition.ts` | `defineQueue`, `defineSchedule`, `jobContext`, `RetryAt`; `DefineQueueOptions`, `DefineScheduleOptions`, `JobContext`, `JobPayloadSchema`, `JobRegistration`, `QueueDefinition`, `QueueOptions`, `QueuePolicy`, `QueueWorker`, `RegistrationRequirements`, `ScheduleDefinition`, `ScheduledWorker` |
| `@shivaedev/jobs/server/service.ts` | `makePgBoss`; `PgBossDefinition`, `PgBossLayerOptions`, `PgBossService` |
| `@shivaedev/jobs/server/schema.ts` | `installPgBossSchema`, `pgBossSchema`; `PgBossSchemaOptions` |
| `@shivaedev/jobs/server/health.ts` | `deadLetterQueueName`; `DeadLetteredJob`, `JobPage`, `JobPageOptions`, `JobsHealth`, `ListedJob`, `QueueCounts`, `QueueHealth` |
| `@shivaedev/jobs/server/error.ts` | `PgBossError`, `PgBossPayloadError`, `PgBossQueueOptionsError`, `PgBossClientOptionsError`, `PgBossTestingError`, `toPgBossError`; `PgBossOperation` |
| `@shivaedev/jobs/server/client.ts` | `defaultClientFactory`; `PgBossClient`, `PgBossClientFactory` |
| `@shivaedev/jobs/server/testing.ts` | `makePgBossTesting`, `testRetryPolicy`; `PgBossTesting`, `PgBossTestingOptions`, `SnapshotQueue`, `UnfinishedJob` |

The definition options keep the pg-boss names: `queue` uses `QueueOptions` (`Queue` except `name` and `deadLetter`, with literal `QueuePolicy` values and `maxDeferrals`), `worker` uses `WorkOptions`, and a schedule's `schedule` uses `ScheduleOptions`. A queue also requires `name` and `schema`; a schedule requires `name` and `cron`.

`Jobs.layer(options)` accepts pg-boss `ConstructorOptions` plus the adapter's own options. Custom clients must supply native `complete` and `fail` capabilities to register queue or schedule workers; missing settlement capabilities fail Layer acquisition with a registration `PgBossError`. Producer-only clients do not need them. Custom clients can also supply the optional native capabilities `findJobs`, `retry`, `update`, `getDb` and `updateQueue` for lookup, retry, live counts and listings, deferral and reconciliation; a requested operation fails with `PgBossError` if its required capability is absent.

`onError` handles pg-boss client `error` events using the services captured by the Layer. Only the owning jobs service is supplied automatically; a handler using another jobs definition still requires that definition's Layer.

Worker registration always requests `includeMetadata: true`, including when `worker` supplies `includeMetadata: false`; custom clients must return pg-boss's `startedOn` metadata. When calling `jobContext` directly, reading `remainingBudget` requires that same metadata.

`PgBossError` has `operation`, optional `queue` and a `Redacted` `original`. Its message names the operation, the queue and the original error's class and `code`, such as a PostgreSQL SQLSTATE, but never the original message, which can quote payloads or connection strings. A registration failure names the queue it was preparing. `PgBossPayloadError` has `direction`, `queue` and a `Redacted` `original`. Those fields distinguish the pg-boss operation from the payload boundary.

### Install, setup and limits

```sh
pnpm add @shivaedev/jobs effect@4.0.5 pg-boss@12.37.0
```

The package requires Node.js 24 or later and PostgreSQL. `effect` and `pg-boss` are peers; use versions that satisfy the package's published peer ranges.

`connectionString` configures pg-boss's own `pg` Pool, separately from the application's Effect SQL pool. In the default configuration a URL without `sslmode` uses plaintext. Outside a private network, add `sslmode=verify-full` (or `require`) to require TLS. The installed `pg` 8.23 driver verifies certificates for both modes and refuses servers without TLS. For private CAs, start Node with `NODE_EXTRA_CA_CERTS=/path/to/ca.pem`. See the [framework database connection security guide](https://github.com/ShivaeDev/platform/blob/main/docs/framework/quickstart.md#database-connection-security) for all three connection paths and the driver's differences from libpq.

Provide the database connection and job registrations at the application runtime boundary. Application services own the domain work and provider calls; pg-boss owns queue execution. Treat enqueueing and an application database transaction as separate operations. Enqueue after the application write commits, and handle queue failures in the application so they cannot roll back the write. The package supplies no application transaction adapter.
