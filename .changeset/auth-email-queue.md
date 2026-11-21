---
"@shivaedev/email": minor
---

### Added

- `authEmailQueue({ paths, copy?, window?, windows? })` from `server/authEmailQueue.ts` declares an application's Better Auth emails once: it returns identity's `emails` mount option together with the queue's producer and worker Layers. Each message is queued as one job on `identity.auth-emails` with its link redacted, a failed enqueue refuses the auth request with `EMAIL_UNAVAILABLE`, and the worker renders default English copy for all five kinds, or the application's `copy` for a kind, as text and escaped HTML. `authEmailJobs` from `authEmailJobs.ts` holds the queue name and payload Schema for client code such as the admin Jobs page. An application that wrote this glue by hand deletes its routes, `deliver`, queue schema and renderer and passes the paths instead.
- `mailerLayer()` from `server/mailerLayer.ts` returns one mailer Layer for every email worker: Resend in production, where it requires `EMAIL_FROM` and `RESEND_API_KEY`, and the development log `Mailer` otherwise.
- `@shivaedev/identity` is an optional peer, needed only by `authEmailQueue`.
