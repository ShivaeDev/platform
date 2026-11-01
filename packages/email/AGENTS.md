# @shivaedev/email

This package lets every Platform application send transactional messages through Resend without rebuilding its delivery queue, development mailer or story inbox. Applications own their message union, wording, sender and recipient; this package owns delivery policy. Read the [README](README.md) for composition and usage.

Native Effect data, typed failures and scoped jobs come first. Keep one Schema from producer to worker, preserve redacted one-time links until rendering, and send the durable job id as Resend's idempotency key. PostgreSQL and the jobs package own execution, backoff and timed deferral; do not build another retry engine here.

Resend is the only delivery provider and a regular dependency, isolated under `adapters/`. Keep the Mailer boundary only as large as Resend, the development log and the fake inbox need. Provider diagnostics must not turn message bodies or links into recorded job failures. Prove delivery at the fake HTTP endpoint with real PostgreSQL behind the queue.

Follow the repository [guidance](../../AGENTS.md) for package conventions and changesets.
