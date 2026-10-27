# Changelog

## 0.1.0 - 2026-10-27

### Added

- First release of `@shivaedev/errors`: the shared expected failures (`taxonomy.ts`), `rejectedField` and the secret-masking policy (`sensitive.ts`, `redact.ts`, `redactCause.ts`) that every Effect boundary uses, and `rpcBoundary` (`boundary.ts`), which keeps declared failures and maps every other failure to one declared fallback. Every module is browser-safe and depends only on `effect`.
