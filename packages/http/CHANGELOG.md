# Changelog

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
