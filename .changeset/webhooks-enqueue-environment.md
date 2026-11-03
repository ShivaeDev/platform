---
"@shivaedev/webhooks": minor
---

### Breaking

- `enqueueWebhookJobs(requests)` and `receive(name, source, key, body, headers)` now read `WebhookEnqueue` from the Effect environment instead of taking a jobs argument. Direct callers import `WebhookEnqueue` from `@shivaedev/webhooks/server/WebhookEnqueue.ts` and provide it with `{ enqueue: jobs.enqueue }` using `Effect.provideService`. `WebhookJob` now holds an enqueue Effect requiring that service. Applications using `webhookRoute({ jobs: Jobs, ... })` keep their existing wiring; the route supplies the narrow service.
