# Changelog

## 0.4.0 - 2026-11-02

### Fixed

- Read HEAD responses and statuses 204, 205 and 304 as empty bytes or text; JSON decoding still rejects empty input.
- Limit encoded responses by bytes exposed by the native client stream, without comparing compressed Content-Length to decoded bytes. Fetch exposes decompressed bytes; Node's native HTTP transport exposes encoded bytes.
- Remove userinfo, query strings and fragments from status-error URLs.
- Keep pagination links on the request's origin.
- Release response bodies before returning status or body-size failures, and keep schema failures from holding HTTP connections.
- Release GitHub response bodies on rejection and before refreshing a rejected installation token, so repeated failures do not exhaust the connection pool.

### Breaking

- Bounded response readers reject NaN, infinite and negative limits with the typed `InvalidBodyLimit` error from `errors.ts`. Pass a finite nonnegative byte limit and handle the new failure in the error channel.
- GitHub methods using the bounded response reader also expose `InvalidBodyLimit` from `@shivaedev/http/errors.ts` for invalid byte limits. Supply finite nonnegative limits and handle that failure alongside existing response failures.
- Pagination rejects automatic fetch redirects so custom headers cannot reach another origin. Pass a direct same-origin page URL instead of a redirecting URL; links to later pages must also use direct URLs. Other fetch options in the current Effect context are preserved. Use a client without redirect-following middleware.
- GitHub listing methods inherit the redirect restriction. List the repository's current API path instead of an endpoint that redirects after a rename or transfer.

## 0.3.1 - 2026-10-31

### Fixed

- Include `CHANGELOG.md` in published package contents so release notes are available in `node_modules`.
- Release checks reject published package `files` lists that omit `CHANGELOG.md`, naming the package and how to include it.
- `RemoteHttpError` carries a readable message naming the status, method, host and path without query strings, headers or bodies.
- Failed jobs record the error message or a summary of its fields with sensitive values redacted, beside the error tag.

## 0.3.0 - 2026-10-30

### Breaking

- Request body reads fail with HTTP 413 before reading when Effect's `HttpIncomingMessage.MaxBodySize` is undefined. Provide a finite byte limit through `Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(limit))` when mounting native routes or webhook routes outside `appHost`.
- `RequestBodyTooLarge` is a Schema tagged error carrying a numeric `limit` in bytes, with `0` for an unconfigured limit. Replace bigint comparisons with number comparisons and obtain request context separately; the error no longer carries `request` or its headers.

## 0.2.0 - 2026-10-30

### Changed

- Require the Effect 4.0.6 stack.

### Fixed

- Publish committed SQL invalidations immediately for their owning database, including when another database has an open transaction.

### Breaking

- `@shivaedev/sql`: migration-body SQL failures now propagate as native typed `MigrationError` failures. Handle them with `Effect.catchTag("MigrationError", ...)` instead of defect recovery; migration-body defects remain defects.
- `@shivaedev/http`: bounded request-body reads use the native reader and its connection cleanup. Do not assume a rejected upload can drain an arbitrarily large unread body and reuse its connection; allow the HTTP client to open a new connection. The optional Node platform peer is no longer required by this package.

## 0.1.1 - 2026-10-29

### Fixed

- The application host constructs services, handlers and routes before listening, so startup connections are refused until requests can be answered.
- Server and HTTP modules import Node platform modules directly to avoid loading Redis during startup.
- Generated apps import Node platform modules directly, and deployment stories allow enough time for their sequential cold processes without a fixed timeout on each startup health probe.

## 0.1.0 - 2026-10-27

### Added

- First release of `@shivaedev/http`: typed status failures (`filterStatus.ts`, `errors.ts`), link pagination (`paginate.ts`) and bounded response bodies (`body.ts`) for Effect's HTTP client, and bounded request bodies for native Node routes (`server/boundedBody.ts`).
