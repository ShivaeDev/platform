---
"@shivaedev/platform": minor
---

### Added

- `appHost` accepts a native `preflight` Layer that builds before migration checks or execution and application startup. Typed failures stop startup; its services remain available to migrations, application construction, application services, RPC handlers and host callers, and its resources close with the host scope. The host option types accept preflight service, error and requirement parameters.
- Export `AppHostFactory`, `AppHostInput` and `HostPreflight` types for annotated host factories, inputs and preflight options.
