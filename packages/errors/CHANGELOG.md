# Changelog

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
