### Fixed

- Answers, including guidance during execution or repair, and `answer --release` acknowledge their durable request before admission work, preserve queued-message order, keep status on automation while applying, and report recording failures instead of confirming an unsaved request.

### Added

- Host integration helpers `answerRequests(host, apply)`, `answerRecords(namespace, workId?)`, `withAnswerRequests(records, requests)`, `answerStore(namespace)` and its `AnswerRequest` type, plus `readRecordSnapshot(effect)` for consistent reads without the admission lock. `answerStore.accept` accepts an absent decision for ordered guidance requests. `answerWork` accepts an optional original decision kind for delayed application.
