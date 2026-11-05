---
"@shivaedev/email": minor
---

### Breaking

- Import `Mailer` from `@shivaedev/email/server/log-mailer/service.ts` instead of `@shivaedev/email/server/Mailer.ts`, and replace `logMailerLayer` with `Mailer.layer`. Each mailer still needs only one Layer to provide.

### Changed

- Trace development sends as `Mailer.send`, with the operation beside its service declaration and no dependencies stored in initializer state.
