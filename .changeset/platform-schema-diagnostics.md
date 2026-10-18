---
"@shivaedev/platform": minor
---

### Added

- `appHost` accepts one `config.sensitiveKeys` list and derives sensitive field names from its RPC schemas' `Schema.Redacted`, `Schema.RedactedFromValue` and `sensitive: true` annotations. These names mask log annotations, RPC failure and defect payloads, reported causes and exported trace attributes, including nested structured data. Successful RPC results retain application data; free-text scanning keeps the existing credential and key rules.
- Expose `RedactionPolicy`, `schemaSensitiveKeys`, `redactingDiagnostics`, `redactRecord`, `redactingTracer` and `redactingRpcSerialization` for native boundary composition. `redactOtlpText` accepts an optional third sensitive-key predicate. `redactDiagnosticCause` and `redactingErrorReporter` also redact typed failure diagnostics; `redactCause` retains typed failures for middleware composition.

### Fixed

- Apply sensitive-key declarations to non-enumerable Error `cause`, `message`, `name` and `stack` fields in reported causes and exported exceptions. Mask stacks when the name or message is sensitive, so their native stack headers cannot repeat those values.
- Apply the same stack masking recursively to Error values in log messages and annotations, reported causes and exported span attributes. Expose `redactErrorStack(error, sensitive)` for the shared native Error stack policy.

### Breaking

- Sensitive fields in RPC failure payloads now contain `<redacted>` after schema encoding. Client error schemas with sensitive fields must accept that marker (for example, union the field schema with `Schema.Literal("<redacted>")`) or omit the field from the wire error schema. Fields containing sensitive array items or record values are masked as a whole. Successful responses keep their existing schemas and values.
