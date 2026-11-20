---
"@shivaedev/errors": patch
---

### Fixed

- `redactText` no longer masks the first word of a sentence that follows a quoted sensitive name, so a diagnostic such as `"user.password": Cannot encode Redacted` stays readable. A name in matching quotes, a colon and a letters-only word followed on the same line by another word is read as prose; a quoted, numeric, symbol-bearing or line-ending value, an `=` assignment and an unquoted name are masked as before.
- `redactText` masks the value of a name wrapped in two kinds of quotes, such as `"'token'": "abc"`, which it previously left in place.
- `redactText` and `redactUrl` scan long runs of name characters, chained `=` assignments and lines with many schema expectations in linear time; such input previously took quadratic time, tens of seconds for a few hundred kilobytes.
