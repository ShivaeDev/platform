---
"@shivaedev/http": minor
"@shivaedev/github": minor
---

### Fixed

- Read HEAD responses and statuses 204, 205 and 304 as empty bytes or text; JSON decoding still rejects empty input.
- Limit encoded responses by bytes exposed by the native client stream, without comparing compressed Content-Length to decoded bytes. Fetch exposes decompressed bytes; Node's native HTTP transport exposes encoded bytes.

### Breaking

- Bounded response readers reject NaN, infinite and negative limits with the typed `InvalidBodyLimit` error from `errors.ts`. Pass a finite nonnegative byte limit and handle the new failure in the error channel.
- GitHub methods using the bounded response reader also expose `InvalidBodyLimit` from `@shivaedev/http/errors.ts` for invalid byte limits. Supply finite nonnegative limits and handle that failure alongside existing response failures.
