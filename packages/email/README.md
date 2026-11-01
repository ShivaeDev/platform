# @shivaedev/email

Send transactional email through Resend with the same Effect services and durable jobs as the rest of your application. Share the delivery machinery once, and let each feature describe its own messages.

## Why you want this

Confirmation and password reset emails need more than an HTTP call: a durable payload, rendering, retries, idempotency and an inbox a story can read. Define those messages once and enqueue them from the web process:

```ts
import { Effect, Redacted, Schema } from "effect";
import { defineEmailQueue } from "@shivaedev/email/server/defineEmailQueue.ts";

const Confirmation = defineEmailQueue(Schema.Struct({ to: Schema.String, url: Schema.Redacted(Schema.String) }), ({ to, url }) =>
	Effect.succeed({
		from: "Accounts <accounts@example.com>",
		to,
		subject: "Confirm your account",
		text: `Confirm your account: ${Redacted.value(url)}`,
		html: `<p>Confirm your account</p>`,
	}),
);

const confirm = Confirmation.enqueue({
	to: "alice@example.com",
	url: Redacted.make("https://example.com/confirm?token=one-time-token"),
});
```

## Using it

### Describe a message and render it

`defineEmailQueue(schema, render, options?)` accepts an object Schema or an object union, and an Effect renderer returning `Email` from `@shivaedev/email/Email.ts`: `from`, `to`, `subject`, `text` and `html`. The optional `name` defaults to `transactional-email`; give separate queues distinct names. The renderer can read application services. Escape application values when interpolating them into HTML.

Use `Schema.Redacted(Schema.String)` for one-time links and keep them wrapped until rendering. The jobs codec durably stores the value and restores its Redacted wrapper in the worker. Redaction masks diagnostics; it does not encrypt PostgreSQL storage.

### Compose the web process and worker

The returned `producerLayer` registers the queue without running a worker or requiring a mailer. `enqueue(message)` reads its `Jobs` service and returns the native optional job id. `queue`, `worker` and `Jobs` remain available for native jobs composition and diagnostics.

Provide `producerLayer` to the web process and `workerLayer` to the worker process. Both read the scoped `PgBoss` client provided by `pgBossLayer` from `@shivaedev/jobs/server/service.ts`. Install the jobs schema through that package's migration path.

```ts
import { Layer } from "effect";
import { resendMailerLayer } from "@shivaedev/email/server/adapters/resendMailerLayer.ts";
import { logMailerLayer } from "@shivaedev/email/server/Mailer.ts";

const producer = Confirmation.producerLayer;
const worker = Confirmation.workerLayer.pipe(Layer.provide(resendMailerLayer()));
const developmentWorker = Confirmation.workerLayer.pipe(Layer.provide(logMailerLayer));
```

`Mailer` is a service defined through `@shivaedev/service`. Its `send(email, idempotencyKey)` method reports typed `MailerError` or native jobs `RetryAt` failures. `resendMailerLayer()` reads `RESEND_API_KEY` with `Config.Redacted`; its options accept an already redacted `apiKey` for scoped configuration. `logMailerLayer` writes the rendered message and key to the development log instead of sending it. The jobs redactor masks sensitive URL parameters in worker logs.

The email worker sends its job id as Resend's idempotency key on every attempt. Ordinary failures retry with the jobs engine's exponential backoff. A Resend 429 uses `Retry-After` seconds or HTTP date as a native timed deferral without consuming an ordinary retry; a missing or invalid header uses a short timed fallback. `MailerError` keeps the provider response redacted and uses a fixed message in recorded failures.

### Read email in stories

Install `@shivaedev/test-story` as a development dependency. In a scoped story setup, acquire `inbox()` from `@shivaedev/email/server/testing/adapters/inbox.ts` and provide its `mailerLayer` to the real worker. It uses the Resend SDK against a loopback fake HTTP endpoint.

`nextEmail` waits for the next accepted message, including its `idempotencyKey`; `emails()` reads accepted messages so far. `emailLink(email)` reads the first HTTP link in the message's text. A story can follow that link through the application's HTTP or React boundary. The inbox's `endpoint` exposes the native fake HTTP controls for scripting provider failures.

### Install and limits

```sh
pnpm add @shivaedev/email effect
```

Resend is the only delivery provider and is included as a regular dependency. The jobs package requires PostgreSQL. Delivery uses Resend's idempotency window; the package does not promise permanent exactly-once delivery. Application policy owns expiring links and retaining queued messages.
