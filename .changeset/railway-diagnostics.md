---
"@shivaedev/server": minor
"@shivaedev/react": minor
"@shivaedev/create-app": minor
---

### Added

- Export Effect logs as trace events and ErrorReporter reports as error spans through the redacting Railway OTLP pipeline in appHost and worker Layers.
- Mount a same-origin browser error reporting route in appHost, with server redaction, bounded reports and per-client rate limiting.
- Generated starters enable Railway manual tracing for web and worker services and mount browser reporting by default.
- Add useBrowserErrors to forward uncaught browser errors and unhandled rejections to the host, removing listeners on unmount.

### Fixed

- Mask complete RPC payload annotations before exporting logs and error reports, keeping sensitive error values out of Railway diagnostics even when the request uses public field names.
