### Changed

- The Fleet daemon uses Platform's local-only RPC guard for its NDJSON HTTP endpoint. Local RPC clients remain supported; cross-origin, rebinding Host and non-NDJSON requests receive HTTP 403.
