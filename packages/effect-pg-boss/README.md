# `@shivaedev/effect-pg-boss`

Effect-native queues, workers, schedules, and lifecycle management for
pg-boss.

This package currently targets exact early-access versions of Effect v4 and
pg-boss. It is built for ShivaeDev applications and may change without a
deprecation period.

## Install

```sh
pnpm add @shivaedev/effect-pg-boss effect pg-boss
```

## Define jobs

A queue pairs its durable wire schema with its Effect handler. The handler only
receives decoded data; malformed stored data fails before domain code runs.

```ts
import { defineQueue } from "@shivaedev/effect-pg-boss"
import { Effect, Schema } from "effect"

export const EmailQueue = defineQueue({
  name: "email",
  schema: Schema.Struct({
    userId: Schema.String,
    attempt: Schema.NumberFromString,
  }),
  queue: {
    retryLimit: 5,
    retryBackoff: true,
  },
})

const emailWorker = EmailQueue.handle(({ userId, attempt }) =>
  Effect.gen(function* () {
    const email = yield* Email
    yield* email.send(userId, attempt)
  }),
)
```

Queue payloads are encoded through the same Schema when enqueued, so transforms
such as `NumberFromString` have one contract in both directions.

Schedules are queues with a cron trigger and an Effect that takes no payload:

```ts
import { defineSchedule } from "@shivaedev/effect-pg-boss"

const Cleanup = defineSchedule({
  name: "cleanup",
  cron: "17 3 * * *",
})

const cleanupWorker = Cleanup.run(
  Effect.gen(function* () {
    const sessions = yield* Sessions
    yield* sessions.removeExpired()
  }),
)
```

Schedules default to UTC. Every job defaults to three retries with exponential
backoff and a `<name>-dlq` dead-letter queue. Ordinary pg-boss queue, worker,
and schedule options can override those defaults.

## Provide the service

Create one service identifier, then provide its scoped Layer. The Layer starts
pg-boss, registers workers and schedules, captures their Effect services, and
stops pg-boss when its scope closes.

```ts
import { makePgBoss } from "@shivaedev/effect-pg-boss"

export const Jobs = makePgBoss("@app/Jobs")

export const JobsLive = Jobs.layer({
  connectionString: databaseUrl,
  schema: "app_jobs",
  jobs: [emailWorker, cleanupWorker],
  developmentCacheKey: "app-jobs",
})
```

`developmentCacheKey` reuses and reference-counts one client across module
reloads outside production. Applications decide which registrations are passed
to the Layer, so environment rules such as production-only schedules remain
application policy.

An `onError` Effect can route pg-boss background errors through application
logging or telemetry. Without one, errors use Effect logging.

## Enqueue and inspect health

```ts
const program = Effect.gen(function* () {
  const jobs = yield* Jobs

  const id = yield* jobs.enqueue(EmailQueue, {
    userId: "user-1",
    attempt: 1,
  })

  const health = yield* jobs.health
  return { id, health }
})
```

`enqueue` returns `Option<string>` because pg-boss can decline a job under a
queue policy. Its payload stays fully typed from the queue Schema. `health`
reports queued, ready, active, failed, and dead-letter counts for every
registered job without choosing an HTTP response shape or application health
policy.
