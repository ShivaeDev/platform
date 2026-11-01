---
"@shivaedev/server": patch
---

### Fixed

- Limit OTLP collector response bodies to 64 KiB, cancelling oversized responses with a typed HTTP decode error while preserving bounded, redacted failure diagnostics.
- Fail host startup with a typed configuration error for malformed or non-HTTP(S) OTLP endpoints instead of disabling export or falling back from an invalid traces endpoint.
