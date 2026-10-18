### Fixed

- Prepared work whose Board item was deleted is released and logged instead of blocking its area queue, including after restart. Scheduler dispatch failures refresh saved blocker text and are logged, so status no longer shows an obsolete area holder.

### Added

- Board lookup failures use the `board-item-missing` decision code and optional `BoardFailure.workId` to distinguish confirmed absence from unreadable or ambiguous Board sources.
