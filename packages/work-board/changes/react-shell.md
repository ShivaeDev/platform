### Changed

- The Board opens as a React shell with TanStack Router and a sidebar rendered from the native navigation query through `effect-react`. Existing pages render in `LegacyMain`, with live updates, reading history and response drafts retained.

### Added

- `boardRouter(options?)` accepts shell query bindings and bootstrap HTML; its existing no-argument form remains available.
- The native browser entry exposes `remember(element)`, `swap(current, incoming, highlight?)`, `legacyRuntime()` and its `RouterBridge` type to share page reconciliation and the legacy router bridge with the React shell.

### Fixed

- Same-document anchor navigation keeps the hosted main node and expanded details in place, including through Back and Forward history.
