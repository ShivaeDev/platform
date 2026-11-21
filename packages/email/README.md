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
import { Mailer } from "@shivaedev/email/server/log-mailer/service.ts";

const producer = Confirmation.producerLayer;
const worker = Confirmation.workerLayer.pipe(Layer.provide(resendMailerLayer()));
const developmentWorker = Confirmation.workerLayer.pipe(Layer.provide(Mailer.layer));
```

`Mailer` from `@shivaedev/email/server/log-mailer/service.ts` is a service defined through `@shivaedev/service`. Its `send(email, idempotencyKey)` method reports typed `MailerError` or native jobs `RetryAt` failures. Its default implementation owns no initializer state and declares no dependencies; the development send operation is traced as `Mailer.send`. `resendMailerLayer()` reads `RESEND_API_KEY` with `Config.Redacted`; its options accept an already redacted `apiKey` for scoped configuration. The Resend SDK bridge stays in the adapter, and consumers provide one mailer Layer. `Mailer.layer` writes the rendered message and key to the development log instead of sending it. The jobs redactor masks sensitive URL parameters in worker logs.

The email worker sends its job id as Resend's idempotency key on every attempt. Ordinary failures retry with the jobs engine's exponential backoff. A Resend 429 uses `Retry-After` seconds or HTTP date as a native timed deferral without consuming an ordinary retry; a missing or invalid header uses a short timed fallback. `MailerError` keeps the provider response redacted and uses a fixed message in recorded failures.

### Send Better Auth's emails

An application with email and password sign-in declares its auth emails once with `authEmailQueue` from `@shivaedev/email/server/authEmailQueue.ts`, instead of writing the queue, the worker, the copy and the `emails` bridge for identity's mount by hand. `paths` names the application path each `AuthEmail` kind links to; each path resolves against `PUBLIC_URL`. `window` and `windows` pass through to identity's per-account delivery windows.

```ts
import { authEmailQueue } from "@shivaedev/email/server/authEmailQueue.ts";

export const AuthEmails = authEmailQueue({
	paths: {
		AccountAlreadyExists: "/sign-in",
		ApproveEmailChange: "/auth/confirm",
		ConfirmAccount: "/auth/confirm",
		ConfirmNewAddress: "/auth/confirm",
		ResetPassword: "/reset-password",
	},
	windows: { AccountAlreadyExists: "1 hour" },
	copy: {
		ResetPassword: () => ({
			subject: "Reset your Example password",
			lines: ["Use this link to choose a new Example password."],
			action: "Choose a new password",
		}),
	},
});
```

`AuthEmails.registration` is the queue's server module: export it from any application source file as `export const authEmailsRegistration = AuthEmails.registration satisfies AppModule;`, with `AppModule` from `@shivaedev/server/AppModule.ts`, and the generated server module list composes its producer Layer into the web process, its worker Layer into the worker and its queue into the admin Jobs page. A host that builds its module list by hand lists `AuthEmails.registration` in `appModules([...])` from `@shivaedev/server/appModules.ts` like any other registration. The worker still needs a mailer Layer, such as `mailerLayer()` below. `AuthEmails.emails` is an Effect that reads `PUBLIC_URL` and the queue's `Jobs` service and returns identity's `BetterAuthEmails`: pass it as `emails` to `betterAuthMount(AppAuth, { emails })` from `@shivaedev/identity/server/better-auth/mount.ts`. With `NODE_ENV=production`, `PUBLIC_URL` is required and a host without it fails at startup with a configuration error naming it; elsewhere it defaults to `http://127.0.0.1:5173` for Vite development. Client code lists the queue through `authEmailJobs` from `@shivaedev/email/authEmailJobs.ts`, which holds the queue name `email.auth-emails` and its payload Schema without server code.

Each auth message becomes one job, addressed to the new address for `ConfirmNewAddress` and to the account's address otherwise, with the link kept `Redacted` in the job payload. When the job cannot be queued, the auth request is refused with the code `EMAIL_UNAVAILABLE`. The worker renders a text body and an HTML body from the kind's copy, escapes the link in the HTML, reads the sender from `EMAIL_FROM` (default `Accounts <onboarding@resend.dev>`) and sends through the `Mailer`. Default English copy covers all five kinds; `copy` replaces a kind's copy with a function that receives the queued message (`to`, `url` and, for `ApproveEmailChange`, `newEmail`) and returns its `subject`, body `lines`, link `action` label and optional `footer`. Kinds without an entry keep the default.

### Choose the mailer by environment

`mailerLayer()` from `@shivaedev/email/server/mailerLayer.ts` returns the one mailer Layer every email worker of an application can share. With `NODE_ENV=production` it requires `EMAIL_FROM` and sends through `resendMailerLayer()`, which requires `RESEND_API_KEY`; a missing variable fails the worker's startup with a configuration error naming it. In any other environment it is the development log `Mailer`.

### Read email in stories

Install `@shivaedev/test-kits` as a development dependency. In a scoped story setup, acquire `inbox()` from `@shivaedev/test-kits/email/adapters/inbox.ts` and provide its `mailerLayer` to the real worker. It uses the Resend SDK against a loopback fake HTTP endpoint.

`nextEmail` waits for the next accepted message, including its `idempotencyKey`; `emails()` reads accepted messages so far. `emailLink(email)` reads the first HTTP link in the message's text. A story can follow that link through the application's HTTP or React boundary. The inbox's `endpoint` exposes the native fake HTTP controls for scripting provider failures.

### Install and limits

```sh
pnpm add @shivaedev/email effect
```

Resend is the only delivery provider and is included as a regular dependency. The jobs package requires PostgreSQL. Delivery uses Resend's idempotency window; the package does not promise permanent exactly-once delivery. Application policy owns expiring links and retaining queued messages.
