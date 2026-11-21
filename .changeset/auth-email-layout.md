---
"@shivaedev/email": minor
---

### Added

- `authEmailQueue` takes an optional `layout` that wraps every auth email's HTML in the application's own document. It receives `AuthEmailLayoutParts` (`subject`, `body` as the copy's lines in `<p>` elements, `action` with `href` and `label`, and `footer`, absent when the copy has none), each already escaped for HTML (`&`, `<`, `>` and `"`), and returns the HTML body. The text body is unchanged, and without `layout` the HTML is the same as before. `AuthEmailLayout` and `AuthEmailLayoutParts` are exported from `@shivaedev/email/server/authEmailQueue.ts`.
