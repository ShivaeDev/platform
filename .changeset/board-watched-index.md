---
"@shivaedev/work-board": minor
---

### Added

- Share a scoped watched index through `board.watchIndex`, with parsed metadata, diagnostics and change events. Reconcile missed filesystem events every minute.
- Read the same index through the `work-board.index` RPC and subscribe with the native live query API.

### Changed

- Keep the Board server's index current in the background before publishing changes to consumers.
