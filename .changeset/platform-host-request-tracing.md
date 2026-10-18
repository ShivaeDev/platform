---
"@shivaedev/platform": patch
---

### Fixed

- App hosts apply request tracing to every served RPC, wrapping authentication and handlers even when the shared group omits `RequestTracing`. Existing declarations run once at the outermost middleware boundary; failures log redacted payloads with request ids.
