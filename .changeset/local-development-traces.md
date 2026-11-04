---
"@shivaedev/server": minor
---

### Added

- Record development spans and correlated logs in a local SQLite store without an OpenTelemetry collector, using the host redaction policy. Configure indexed attributes and compose `localTracing` directly with scoped flushing and run retention.

### Changed

- Start development server and worker processes with `NODE_ENV=development`. Hosts without an OTLP endpoint record locally in this mode.
