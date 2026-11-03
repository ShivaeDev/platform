# Changelog

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
