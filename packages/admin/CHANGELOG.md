# Changelog

## 0.3.0 - 2026-10-25

### Added

- Add an explicitly retry-enabled Jobs page and handlers for registered failed originals, with administrator-only RPC access and query invalidation after retry.

## 0.2.0 - 2026-10-25

### Added

- `@shivaedev/admin` provides a query-only Jobs page with explicitly registered queues, payload codecs, health, counts, paginated failed and dead-lettered jobs, and job lookup through the protected admin RPC group. Jobs failures remain declared and do not prevent other pages from serving requests.
- `@shivaedev/effect-pg-boss` job reads accept a queue's name and payload Schema without requiring its worker configuration.

## 0.1.5 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.1.4 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.1.3 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.1.2 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.1.1 - 2026-10-25

### Changed

- Release with updated workspace dependencies.

## 0.1.0 - 2026-10-25

### Added

- Declare admin pages with native Effect contracts protected by `AuthenticatedAdmin`, including generated change subscriptions. Merge pages into one registry with unique ids, paths and RPC tags, and register one typed handler Layer per page for the existing RPC host.
