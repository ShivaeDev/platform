---
"@shivaedev/create-app": patch
---

### Fixed

- Generated Railway workers receive shared `RESEND_API_KEY`, `EMAIL_FROM` and `PUBLIC_URL` settings. Production workers require an explicit email sender at startup; deployment instructions describe queued auth email delivery and the worker's production settings.
