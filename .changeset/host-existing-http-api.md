---
"@shivaedev/server": minor
---

### Added

- Allow `appHost` to omit both the native RPC `group` and `handlers` while serving an existing HTTP API through `routes`, as a migration step towards native RPC. Host services, migrations, body-limit configuration, proxy trust, health and tracing retain their existing behavior; the existing API owns authentication and CORS. No native RPC endpoint or RPC preflight policy is installed without a group.

### Breaking

- Host option types include the HTTP-only shape. Consumers that inspect native RPC options must narrow with `options.group !== undefined` before reading the group or handlers. Existing native `appHost` calls retain their options.
