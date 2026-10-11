### Added

- Release several terminal needs-human items with `work-fleet release <id>... --board <board-dir>`, recording closing responses for their decisions, including done and deferred tasks.

### Fixed

- Apply release answers after task content or location changes without requiring current approval. Stale retry closes its decision and publishes one replacement for the current revision, with publication and acknowledgement recovery after restart.
