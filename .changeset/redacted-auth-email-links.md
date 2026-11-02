---
"@shivaedev/identity": minor
"@shivaedev/create-app": patch
---

### Breaking

- `@shivaedev/identity`: Auth email messages carry `url` and every `token` as Effect `Redacted<string>`. Apps must use `Redacted.value(message.url)` and `Redacted.value(message.token)` when rendering email content or submitting tokens, and pass the wrapped values directly to redacted queue fields.

### Fixed

- `@shivaedev/create-app`: Generated starters pass the redacted auth email URL directly to their email queue, preserving redaction until the mailer renders it.
