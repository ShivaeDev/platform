# Changelog

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
