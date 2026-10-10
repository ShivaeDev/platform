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

The application creates one jobs service with `makePgBoss(identifier)`. Its Layer starts a client, registers the job list and captures the services those workers need. The Layer's scope owns its client reference and releases it when the scope ends; the final reference closes the client. Callers use the jobs service to enqueue a decoded payload or read queue health.

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

The constructor options belong to pg-boss. `jobs` is the complete list of registrations for this Layer. The Layer captures `MailLive` for both the queue handler and the scheduled Effect. A startup or registration failure fails Layer acquisition with `PgBossError` and releases its acquired client reference. A shared client stays running while another scope still owns a reference.

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

`health` exposes pg-boss queue counts as data. Its total fields include the registered queue's active, failed, queued and ready counts, plus the dead-letter queue's queued count. Decide in the application which values affect an HTTP health response or an alert.

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

### API

Import the module that defines the name; the package has no root entry.

| Module | Public names |
| --- | --- |
| `@shivaedev/effect-pg-boss/definition.ts` | `defineQueue`, `defineSchedule`, `jobContext`; `DefineQueueOptions`, `DefineScheduleOptions`, `JobContext`, `JobPayloadSchema`, `JobRegistration`, `QueueDefinition`, `QueueWorker`, `RegistrationRequirements`, `ScheduleDefinition`, `ScheduledWorker` |
| `@shivaedev/effect-pg-boss/service.ts` | `makePgBoss`; `PgBossDefinition`, `PgBossLayerOptions`, `PgBossService` |
| `@shivaedev/effect-pg-boss/health.ts` | `deadLetterQueueName`; `JobsHealth`, `QueueHealth` |
| `@shivaedev/effect-pg-boss/error.ts` | `PgBossError`, `PgBossPayloadError`, `toPgBossError`; `PgBossOperation` |
| `@shivaedev/effect-pg-boss/client.ts` | `defaultClientFactory`; `PgBossClient`, `PgBossClientFactory` |

The definition options keep the pg-boss names: `queue` uses `QueueOptions` except `deadLetter`, `worker` uses `WorkOptions`, and a schedule's `schedule` uses `ScheduleOptions`. A queue also requires `name` and `schema`; a schedule requires `name` and `cron`.

The application's service has two operations:

- `enqueue(queue, payload, options?)`: an Effect returning `Option.Option<string>`, with `PgBossError | PgBossPayloadError` in its error type. Its options use pg-boss `SendOptions`.
- `health`: an Effect returning `JobsHealth`, with `PgBossError` in its error type.

`Jobs.layer(options)` accepts pg-boss `ConstructorOptions` plus `jobs`, optional `clientCacheKey`, optional `clientFactory`, optional `onError` and optional `stop`. The factory type accepts constructor options and returns `PgBossClient`; `onError` has the type `(error: Error) => Effect.Effect<unknown, never, R>`; `stop` uses pg-boss `StopOptions`.

`onError` handles pg-boss client `error` events using the services captured by the Layer. The Layer's requirement type includes the workers' services, the payload Schemas' `DecodingServices` and the callback's services. `enqueue` includes the payload Schema's `EncodingServices` in its requirement type.

`JobContext` has `id`, `name`, `signal`, `expireInSeconds` and `heartbeatSeconds`. `QueueHealth` has `name`, `activeCount`, `deadLetteredCount`, `failedCount`, `queuedCount` and `readyCount`. `JobsHealth` has `jobs` and the corresponding `activeTotal`, `deadLetteredTotal`, `failedTotal`, `queuedTotal` and `readyTotal` fields.

`PgBossError` has `operation`, optional `queue` and a `Redacted` `original`. `PgBossPayloadError` has `direction`, `queue` and a `Redacted` `original`. Those fields distinguish the pg-boss operation from the payload boundary.

### Install, setup and limits

```sh
pnpm add @shivaedev/effect-pg-boss effect@4.0.0-rc.112 pg-boss@12.23.1
```

The package requires Node.js 24 or later and PostgreSQL. `effect` and `pg-boss` are peers; use versions that satisfy the package's published peer ranges.

Provide the database connection and job registrations at the application runtime boundary. Application services own the domain work and provider calls; pg-boss owns queue execution. Treat enqueueing and an application database transaction as separate operations, and choose any required transaction or outbox policy in the application.

For package development, the real PostgreSQL test uses `PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL` and skips when the variable is absent. A skipped test does not establish durable queue behavior. Fake-client tests cover registration and lifecycle calls; they do not establish real cron execution, retry timing or deployment behavior. The package is built for ShivaeDev applications and may change without a deprecation period.

The [north star](./docs/north-star.md) explains the design trade-offs; the [roadmap](./docs/roadmap.md) owns package work and open choices.
