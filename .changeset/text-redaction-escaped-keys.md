---
"@shivaedev/errors": patch
"@shivaedev/http": patch
---

### Fixed

- `@shivaedev/errors`: `redactText` masks the value of a sensitive name written in backslash-escaped quotes, up to three levels deep, so `{"error":"{\"access_token\":\"abc\"}"}` and a log line holding `\"password\":\"hunter2\"` read `<redacted>` between the escaped quotes; before, the secret stayed. An escaped quoted path followed by prose, such as `\"user.password\": Cannot encode Redacted`, stays readable as its unescaped form does.
- `@shivaedev/errors`: `redactText` reads a quoted value whose name is not sensitive for the assignments inside it, so `message: "password: hunter2"` and `"error_description":"client_secret: abc is invalid"` mask the secret; before, the whole quoted value was skipped unless it held `=`.
- `@shivaedev/errors`: `redactText` masks the credential after any scheme in an `Authorization:` or `Proxy-Authorization:` header, such as `Authorization: token …` or `Digest …`; before, only `Bearer` and `Basic` credentials were masked and the credential after another scheme stayed.
- `@shivaedev/errors`: `redactText` masks a `-----BEGIN … PRIVATE KEY-----` block without its matching footer through the end of the text, as in a cut excerpt, and scans many such headers in linear time; before, an unterminated block stayed readable and thousands of headers took seconds.
- `@shivaedev/http`: the `bodyExcerpt` and `message` of a status failure mask secrets in JSON escaped inside the remote's error body, such as `{"error":"{\"access_token\":\"…\"}"}`, which they previously carried in plain text.
