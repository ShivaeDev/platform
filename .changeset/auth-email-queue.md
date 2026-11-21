---
"@shivaedev/email": minor
---

### Added

- `authEmailQueue({ paths, copy?, window?, windows? })` from `server/authEmailQueue.ts` declares an application's Better Auth emails once. It returns identity's `emails` mount option and a `registration` that the application exports `satisfies AppModule`, so the generated module list composes the queue's producer, worker and admin entry. Each message is queued as one job on `email.auth-emails` with its link redacted, a failed enqueue refuses the auth request with `EMAIL_UNAVAILABLE`, and the worker renders default English copy for all five kinds, or the application's `copy` for a kind, as text and escaped HTML. Links resolve against `PUBLIC_URL`, which a production host (`NODE_ENV=production`) requires at startup and development defaults to `http://127.0.0.1:5173`. An application that wrote this glue by hand deletes its routes, `deliver`, queue schema, renderer and registration lines and passes the paths instead; auth emails still pending on its own queue at deploy are not sent, and people request them again.
- `authEmailJobs` from `authEmailJobs.ts` holds the queue name and payload Schema for client code such as the admin Jobs page.
- `mailerLayer()` from `server/mailerLayer.ts` returns one mailer Layer for every email worker: Resend in production, where it requires `EMAIL_FROM` and `RESEND_API_KEY`, and the development log `Mailer` otherwise.
- `@shivaedev/identity` is an optional peer, needed only by `authEmailQueue`.
