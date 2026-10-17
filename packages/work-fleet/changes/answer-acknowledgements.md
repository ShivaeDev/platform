### Fixed

- Waiting answers and `answer --release` acknowledge their durable request before admission work, keep status on automation while applying, and report recording failures instead of confirming an unsaved request.

### Added

- Host integration helpers `answerRequests(host, apply)`, `answerRecords(namespace, workId?)`, `withAnswerRequests(records, requests)`, `answerStore(namespace)` and its `AnswerRequest` type, plus `readRecordSnapshot(effect)` for consistent reads without the admission lock. `answerWork` accepts an optional original decision kind for delayed application.
