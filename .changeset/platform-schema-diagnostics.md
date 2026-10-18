---
"@shivaedev/platform": minor
---

### Added

- `appHost` accepts one `config.sensitiveKeys` list and derives sensitive field names from its RPC schemas' `Schema.Redacted`, `Schema.RedactedFromValue` and `sensitive: true` annotations. These names mask log annotations, RPC failure and defect payloads, reported causes and exported trace attributes, including nested structured data. Successful RPC results retain application data; free-text scanning keeps the existing credential and key rules.
- Expose `RedactionPolicy`, `schemaSensitiveKeys`, `redactingDiagnostics`, `redactRecord`, `redactingTracer` and `redactingRpcSerialization` for native boundary composition. `redactOtlpText` accepts an optional third sensitive-key predicate. `redactDiagnosticCause` and `redactingErrorReporter` also redact typed failure diagnostics; `redactCause` retains typed failures for middleware composition.

### Fixed

- Honor sensitive annotations on schema checks and nested check groups in logs, RPC failures and exported span attributes.
- Apply the source `_tag` sensitivity before tracing copies an error tag into `rpc.failure`, so schema annotations and host-listed keys also protect the failure log.
- Apply sensitive-key declarations to non-enumerable Error `cause`, `message`, `name` and `stack` fields in reported causes and exported exceptions. Mask stacks when the name or message is sensitive, so their native stack headers cannot repeat those values.
- Apply the same stack masking recursively to Error values in log messages and annotations, reported causes and exported span attributes. Expose `redactErrorStack(error, sensitive)` for the shared native Error stack policy.
- Carry sensitive field names through `Schema.encodeKeys` so renamed failure fields and diagnostics stay redacted. Collect declarations before propagating encoded names until stable, making direct and chained mappings independent of schema traversal order. Detect sensitive descendants throughout the transformation source, including app-listed keys, so flattening nested fields cannot lose their sensitivity. Derive policy without executing encoder callbacks and mask every declared encoded target field, including every union branch, because opaque callbacks cannot guarantee field provenance.
- Mask the enclosing field when a sensitive source encodes to a scalar, including host-listed keys. Preserve native RPC protocol tags while masking application error fields.
- Mask encoded Error stacks in RPC failure payloads when `message` or `name` is sensitive, including `Schema.Defect({ includeStack: true })`.

### Breaking

- Sensitive fields in RPC failure payloads now contain `<redacted>` after schema encoding. Client error schemas with sensitive fields must accept that marker (for example, union the field schema with `Schema.Literal("<redacted>")`) or omit the field from the wire error schema. An encoder with a sensitive source masks all declared output fields, including otherwise public fields and error discriminators; client wire-error schemas must accept those markers too. Fields containing sensitive array items or record values are masked as a whole. Successful responses keep their existing schemas and values.
