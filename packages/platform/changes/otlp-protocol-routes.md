### Fixed

- Honour OTLP protocol configuration, including the traces-specific override, with native Effect JSON and protobuf encoders and sensitive diagnostic redaction in both. Default to `http/protobuf` as recommended by OpenTelemetry and fail configuration for unsupported protocols.
- Name exported HTTP server spans with the method and matched route template, preserving `http.route` and incoming trace context; unmatched requests retain the method alone.
- Warn on the first failed OTLP export with the collector status and redacted answer, and include `OTEL_SERVICE_VERSION` as `service.version`.
