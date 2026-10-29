# Changelog

## 0.1.1 - 2026-10-29

### Fixed

- The application host constructs services, handlers and routes before listening, so startup connections are refused until requests can be answered.
- Server and HTTP modules import Node platform modules directly to avoid loading Redis during startup.
- Generated apps import Node platform modules directly, and deployment stories allow enough time for their sequential cold processes without a fixed timeout on each startup health probe.

## 0.1.0 - 2026-10-27

### Added

- First release of `@shivaedev/http`: typed status failures (`filterStatus.ts`, `errors.ts`), link pagination (`paginate.ts`) and bounded response bodies (`body.ts`) for Effect's HTTP client, and bounded request bodies for native Node routes (`server/boundedBody.ts`).
