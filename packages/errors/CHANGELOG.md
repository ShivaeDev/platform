# Changelog

## 0.3.0 - 2026-10-31

### Added

- `rpcBoundaryHandlers(group, boundary, handlers)` applies one boundary and unexpected mapping to a native RPC handler map, including Effect and Stream handlers and native RPC wrappers.
- Contract changes streams declare `WebSocketRequired` so HTTP clients can decode the protocol error.

### Fixed

- Hosted `$changes` subscriptions over HTTP fail with a message saying they need the WebSocket protocol.

## 0.2.0 - 2026-10-31

### Added

- `@shivaedev/errors/taxonomy.ts` exports class guards (`isConflict`, `isNotFound` and one `is<Class>` guard for every other taxonomy error). They narrow actual class instances and reject objects with matching tags.

### Fixed

- Logs, error reports, RPC failure data and exported spans share errors' database-key and URL policy. Database users and connection strings are masked under their diagnostic keys; URL user information, query values and fragments are masked in structured values and text.

### Breaking

- Import `schemaSensitiveKeys` from `@shivaedev/errors/schemaSensitiveKeys.ts` instead of server, and `redactRecord` from `@shivaedev/errors/redact.ts` instead of server's `redactingDiagnostics.ts`.
- Import schema sensitivity AST helpers from `@shivaedev/errors/schemaSensitiveAst.ts` instead of `@shivaedev/server/schemaSensitiveAst.ts`.
- Replace server's `redactOtlpUrl` with `redactUrl` from `@shivaedev/errors/sensitive.ts`. Replace server's `redactOtlpText(value, key, sensitive)` with `redactText(value, sensitive, undefined, key)` from `@shivaedev/errors/sensitive.ts`.
- Errors' redaction helpers now apply the same URL and database-key masking previously applied only to exported traces. Consumers should expect `<redacted>` for URL user information, query values and fragments, and for `db.user`, `db.user.name` and `db.connection_string` values.

## 0.1.3 - 2026-10-31

### Fixed

- Include `CHANGELOG.md` in published package contents so release notes are available in `node_modules`.
- Release checks reject published package `files` lists that omit `CHANGELOG.md`, naming the package and how to include it.

## 0.1.2 - 2026-10-30

### Fixed

- Report failures and defects masked by `rpcBoundary` through Effect's error reporters at Error severity with diagnostic redaction before returning the rejection.
- Log boundary-masked RPC failures once at ERROR with their redacted stack; keep declared rejections at INFO.

## 0.1.1 - 2026-10-30

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.

## 0.1.0 - 2026-10-27

### Added

- First release of `@shivaedev/errors`: the shared expected failures (`taxonomy.ts`), `rejectedField` and the secret-masking policy (`sensitive.ts`, `redact.ts`, `redactCause.ts`) that every Effect boundary uses, and `rpcBoundary` (`boundary.ts`), which keeps declared failures and maps every other failure to one declared fallback. Every module is browser-safe and depends only on `effect`.
