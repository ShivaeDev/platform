---
"@shivaedev/http": minor
"@shivaedev/webhooks": minor
---

### Breaking

- Request body reads fail with HTTP 413 before reading when Effect's `HttpIncomingMessage.MaxBodySize` is undefined. Provide a finite byte limit through `Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(limit))` when mounting native routes or webhook routes outside `appHost`.
- `RequestBodyTooLarge` is a Schema tagged error carrying a numeric `limit` in bytes, with `0` for an unconfigured limit. Replace bigint comparisons with number comparisons and obtain request context separately; the error no longer carries `request` or its headers.
