### Added

- `useEditor` and `useCreate` accept opt-in `persistedDraft` settings with application keys, storage and bounds. They inherit `SessionBoundary` ownership, which drops tracked drafts when the session changes or ends, including drafts from unmounted screens.

### Changed

- Include `@shivaedev/effect-form` as a workspace dependency for shared draft ownership at the session boundary.

### Fixed

- Reconcile `SessionBoundary` draft ownership when a session replacement commits. A suspended, canceled transition preserves the visible session's draft and future persistence; committed replacements also clear old drafts while Activity is hidden.
