### Added

- Configure repository-specific worker instructions with `worker.workerGuidance` as inline text or a `{ "file": "worker.md" }` path relative to the Board folder. Fleet includes the resolved text in initial worker prompts, repair turns, manual continuations and report corrections. An unreadable file fails host policy creation.
