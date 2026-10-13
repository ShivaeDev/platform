### Added

- `appHost` accepts `config.maxBodySize` and the `MAX_BODY_SIZE` environment variable to limit RPC request bodies in bytes; explicit config takes precedence.

### Changed

- RPC request bodies default to a 1 MiB limit. Oversized NDJSON requests return a 4xx before any RPC handler runs.
