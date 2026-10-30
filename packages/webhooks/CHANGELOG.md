# Changelog

## 0.1.3 - 2026-10-30

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.

## 0.1.2 - 2026-10-29

### Changed

- Release with updated workspace dependencies.

## 0.1.1 - 2026-10-28

### Changed

- Release with updated workspace dependencies.

## 0.1.0 - 2026-10-27

### Added

- Receive signed deliveries through an HttpRouter Layer, record deduplicated receipts and queue typed jobs atomically, with a GitHub strategy and a receipt SchemaComponent.
