### Added

- Configure repository-specific reviewer instructions with `worker.reviewerGuidance` in the host config, as inline text or a `{ "file": "…" }` path relative to the Board folder. The host supplies the text through `FleetPolicy.reviewerGuidance` to initial reviewer prompts and verdict follow-ups.

### Changed

- Default reviewer prompts no longer include Platform-specific PostgreSQL commands, environment variables or source paths. Hosts supply their own validation guidance.
