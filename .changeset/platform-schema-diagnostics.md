---
"@shivaedev/platform": minor
---

### Added

- `appHost` accepts one `config.sensitiveKeys` list and derives sensitive field names from its RPC schemas' `Schema.Redacted`, `Schema.RedactedFromValue` and `sensitive: true` annotations. These names mask log annotations, RPC failure and defect payloads, reported causes and exported trace attributes, including nested structured data. Successful RPC results retain application data; free-text scanning keeps the existing credential and key rules.
- Expose `RedactionPolicy`, `schemaSensitiveKeys`, `redactingDiagnostics`, `redactRecord`, `redactingTracer` and `redactingRpcSerialization` for native boundary composition. `redactOtlpText` accepts an optional third sensitive-key predicate. `redactDiagnosticCause` and `redactingErrorReporter` also redact typed failure diagnostics; `redactCause` retains typed failures for middleware composition.

### Breaking

- Sensitive fields in RPC failure payloads now contain `<redacted>` after schema encoding. Client error schemas with sensitive fields must accept that marker (for example, union the field schema with `Schema.Literal("<redacted>")`) or omit the field from the wire error schema. Fields containing sensitive array items or record values are masked as a whole. Successful responses keep their existing schemas and values.
