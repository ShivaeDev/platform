# Changelog

## 0.10.3 - 2026-11-21

### Changed

- Update `@shivaedev/http` from 0.9.2 to 0.9.3.
- Update `@shivaedev/identity` from 0.44.1 to 0.44.2.
- Update `@shivaedev/jobs` from 0.45.0 to 0.45.1.

## 0.10.2 - 2026-11-21

### Changed

- Update `@shivaedev/jobs` from 0.44.1 to 0.45.0.

## 0.10.1 - 2026-11-21

### Changed

- Update `@shivaedev/identity` from 0.44.0 to 0.44.1.

## 0.10.0 - 2026-11-21

### Added

- `authEmailQueue` takes an optional `layout` that wraps every auth email's HTML in the application's own document. It receives `AuthEmailLayoutParts` (`subject`, `body` as the copy's lines in `<p>` elements, `action` with `href` and `label`, and `footer`, absent when the copy has none), each already escaped for HTML (`&`, `<`, `>` and `"`), and returns the HTML body. The text body is unchanged, and without `layout` the HTML is the same as before. `AuthEmailLayout` and `AuthEmailLayoutParts` are exported from `@shivaedev/email/server/authEmailQueue.ts`.

## 0.9.0 - 2026-11-21

### Breaking

- `authEmailQueue`'s `registration` no longer has `group`, `handlers` or `name`; it carries only its queue, producer services and worker. It needs the `@shivaedev/server` version that ships the third `AppModule` form: an older `AppModule` refuses it in `satisfies AppModule` and `appModules([...])`. Code that read `registration.name` reads `authEmailJobs.name` from `@shivaedev/email/authEmailJobs.ts`, which holds the same value.

## 0.8.6 - 2026-11-21

### Changed

- Update `@shivaedev/identity` from 0.41.0 to 0.42.0.

## 0.8.5 - 2026-11-21

### Changed

- Update `@shivaedev/identity` from 0.40.0 to 0.41.0.

## 0.8.4 - 2026-11-21

### Changed

- Update `@shivaedev/identity` from 0.39.0 to 0.40.0.
- Update `@shivaedev/jobs` from 0.44.0 to 0.44.1.

## 0.8.3 - 2026-11-21

### Changed

- Update `@shivaedev/identity` from 0.38.3 to 0.39.0.

## 0.8.2 - 2026-11-21

### Changed

- Update `@shivaedev/identity` from 0.38.2 to 0.38.3.

## 0.8.1 - 2026-11-21

### Changed

- Update `@shivaedev/identity` from 0.38.1 to 0.38.2.

## 0.8.0 - 2026-11-21

### Added

- `authEmailQueue({ paths, copy?, window?, windows? })` from `server/authEmailQueue.ts` declares an application's Better Auth emails once. It returns identity's `emails` mount option and a `registration` that the application exports `satisfies AppModule`, so the generated module list composes the queue's producer, worker and admin entry. Each message is queued as one job on `email.auth-emails` with its link redacted, a failed enqueue refuses the auth request with `EMAIL_UNAVAILABLE`, and the worker renders default English copy for all five kinds, or the application's `copy` for a kind, as text and escaped HTML. Links resolve against `PUBLIC_URL`, which a production host (`NODE_ENV=production`) requires at startup and development defaults to `http://127.0.0.1:5173`. An application that wrote this glue by hand deletes its routes, `deliver`, queue schema, renderer and registration lines and passes the paths instead; auth emails still pending on its own queue at deploy are not sent, and people request them again.
- `authEmailJobs` from `authEmailJobs.ts` holds the queue name and payload Schema for client code such as the admin Jobs page.
- `mailerLayer()` from `server/mailerLayer.ts` returns one mailer Layer for every email worker: Resend in production, where it requires `EMAIL_FROM` and `RESEND_API_KEY`, and the development log `Mailer` otherwise.
- `@shivaedev/identity` is an optional peer, needed only by `authEmailQueue`.

## 0.7.16 - 2026-11-21

### Changed

- Update `@shivaedev/jobs` from 0.43.2 to 0.44.0.

## 0.7.15 - 2026-11-20

### Changed

- Update `@shivaedev/http` from 0.9.1 to 0.9.2.
- Update `@shivaedev/jobs` from 0.43.1 to 0.43.2.

## 0.7.14 - 2026-11-20

### Changed

- Update `@shivaedev/http` from 0.9.0 to 0.9.1.
- Update `@shivaedev/jobs` from 0.43.0 to 0.43.1.

## 0.7.13 - 2026-11-20

### Changed

- Require Effect 4.1.4 and its matching platform packages.

## 0.7.12 - 2026-11-19

### Changed

- Update `@shivaedev/jobs` from 0.42.4 to 0.42.5.

## 0.7.11 - 2026-11-18

### Changed

- Update `@shivaedev/jobs` from 0.42.3 to 0.42.4.

## 0.7.10 - 2026-11-18

### Changed

- Update `@shivaedev/jobs` from 0.42.2 to 0.42.3.

## 0.7.9 - 2026-11-11

### Changed

- Update `@shivaedev/http` from 0.8.1 to 0.8.2.
- Update `@shivaedev/jobs` from 0.42.1 to 0.42.2.
- Update `@shivaedev/service` from 0.9.0 to 0.9.1.

## 0.7.8 - 2026-11-08

### Changed

- Update `@shivaedev/jobs` from 0.42.0 to 0.42.1.

## 0.7.7 - 2026-11-08

### Changed

- Update `@shivaedev/jobs` from 0.41.4 to 0.42.0.
- Update `@shivaedev/service` from 0.8.2 to 0.9.0.

## 0.7.6 - 2026-11-07

### Changed

- Update `@shivaedev/jobs` from 0.41.3 to 0.41.4.

## 0.7.5 - 2026-11-07

### Changed

- Update `@shivaedev/jobs` from 0.41.2 to 0.41.3.
- Update `@shivaedev/service` from 0.8.1 to 0.8.2.

## 0.7.4 - 2026-11-07

### Changed

- Update `@shivaedev/http` from 0.8.0 to 0.8.1.
- Update `@shivaedev/jobs` from 0.41.1 to 0.41.2.
- Update `@shivaedev/service` from 0.8.0 to 0.8.1.

## 0.7.3 - 2026-11-07

### Changed

- Update `@shivaedev/jobs` from 0.41.0 to 0.41.1.

## 0.7.2 - 2026-11-06

### Changed

- Update `@shivaedev/jobs` from 0.40.1 to 0.41.0.

## 0.7.1 - 2026-11-06

### Changed

- Update `@shivaedev/jobs` from 0.40.0 to 0.40.1.

## 0.7.0 - 2026-11-05

### Changed

- Trace development sends as `Mailer.send`, with the operation beside its service declaration and no dependencies stored in initializer state.

### Breaking

- Import `Mailer` from `@shivaedev/email/server/log-mailer/service.ts` instead of `@shivaedev/email/server/Mailer.ts`, and replace `logMailerLayer` with `Mailer.layer`. Each mailer still needs only one Layer to provide.

## 0.6.0 - 2026-11-05

### Breaking

- Require Effect 4.1.0 and its matching companion packages. Move `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, `@effect/sql-pg`, `@effect/sql-sqlite-node`, `@effect/atom-react` and `@effect/vitest` to exactly 4.1.0 together.

## 0.5.0 - 2026-11-05

### Breaking

- Import development mail rendering from `server/log-mailer/send.ts` instead of `server/internal/log-mailer/send.ts`.

## 0.4.4 - 2026-11-05

### Changed

- Update `@shivaedev/http` from 0.6.1 to 0.7.0.
- Update `@shivaedev/jobs` from 0.37.0 to 0.37.1.

## 0.4.3 - 2026-11-04

### Changed

- Update `@shivaedev/jobs` from 0.36.0 to 0.37.0.

## 0.4.2 - 2026-11-04

### Changed

- Require Effect 4.0.7 and its matching companion packages. Install the 4.0.7 Effect stack together.

## 0.4.1 - 2026-11-04

### Changed

- Update `@shivaedev/jobs` from 0.35.0 to 0.35.1.

## 0.4.0 - 2026-11-04

### Breaking

- TypeScript source exports now use `@shivaedev/source` instead of `source`. Replace `source` with `@shivaedev/source` in Node `--conditions`, TypeScript `customConditions`, and Vite/Vitest `resolve.conditions`. Bare `source` selects built JavaScript; no compatibility alias is provided.

## 0.3.2 - 2026-11-04

### Changed

- Update `@shivaedev/jobs` from 0.33.0 to 0.34.0.
- Update `@shivaedev/service` from 0.6.1 to 0.6.2.

## 0.3.1 - 2026-11-03

### Changed

- Update `@shivaedev/jobs` from 0.32.0 to 0.33.0.

## 0.3.0 - 2026-11-03

### Breaking

- Move `inbox`, `emailLink` and `ReceivedEmail` from `@shivaedev/email/server/testing/adapters/inbox.ts` to `@shivaedev/test-kits/email/adapters/inbox.ts`. Add test-kits as a development dependency. Email no longer has a test-story peer dependency.

## 0.2.0 - 2026-11-03

### Breaking

- Queue definitions returned by `defineEmailQueue` expose jobs-owned queue and worker options. Import `QueueOptions` from `@shivaedev/jobs/server/queueOptions.ts` and `WorkerOptions` from `@shivaedev/jobs/server/workerOptions.ts` for explicit annotations.

## 0.1.2 - 2026-11-02

### Changed

- Update `@shivaedev/jobs` from 0.29.2 to 0.30.0.
- Update `@shivaedev/test-story` from 0.33.0 to 0.34.0.

## 0.1.1 - 2026-11-02

### Changed

- Update `@shivaedev/http` from 0.3.1 to 0.4.0.
- Update `@shivaedev/jobs` from 0.29.1 to 0.29.2.
- Update `@shivaedev/service` from 0.6.0 to 0.6.1.
- Update `@shivaedev/test-story` from 0.32.0 to 0.33.0.

## 0.1.0 - 2026-11-01

### Added

- Send transactional email through a Resend-backed Mailer or development log, with typed message queues, job-id idempotency, backoff and provider-timed rate-limit retries.
- Read delivered messages and one-time links through a fake Resend inbox in stories.
- Include the email package in Platform for applications, including the starter's queued authentication emails.
