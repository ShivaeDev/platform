---
"@shivaedev/server": minor
---

### Added

- First release of `@shivaedev/server`, the application host extracted from `@shivaedev/platform`: `appHost`, the database layer and migrations, health, OTLP export, the redacting tracer and RPC serialization, development mode, the Promise runtime (`runtime/`) and Node subscription signals (`node-http/`). Modules sit at the package root, so `@shivaedev/platform/server/appHost.ts` becomes `@shivaedev/server/appHost.ts`. The `AppChanges` and `RedactionPolicy` service ids now name the package.
