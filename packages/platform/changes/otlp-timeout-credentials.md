### Fixed

- Bound OTLP HTTP export attempts to 10 seconds by default, honor standard general and traces-specific timeout variables, and read the batch interval, size and shutdown timeout through Effect Config.
- Redact bare `sig` assignments and PEM private-key blocks from exported trace values in both JSON and protobuf.
