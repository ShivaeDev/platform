### Fixed

- Answers, including guidance during execution or repair, and `answer --release` acknowledge their durable request before admission work, preserve queued-message order, keep status on automation while applying, and report recording failures instead of confirming an unsaved request.

- Admission waiters return database connections between attempts so pending answers and reconciliations cannot fill the pool and block answer recording or status.

- Reconciled clarification and deferral receipts keep later answers and releases applicable. Recovery deduplicates only the exact response published for the pending request.

- Followers retry reconnects that produce no initial snapshot within five seconds; established quiet subscriptions remain open.

### Added

- Host integration helpers `answerRequests(host, apply)`, `answerRecords(namespace, workId?)`, `withAnswerRequests(records, requests)`, `answerStore(namespace)` and its `AnswerRequest` type, plus `readRecordSnapshot(effect)` for consistent reads without the admission lock. `answerStore.accept` accepts an absent decision for ordered guidance requests. `answerWork` accepts an optional original decision kind for delayed application. Its optional `onPublished(response)` callback and the `answerRequests` apply callback persist response identity through `answerStore.recordResponse(request, response)`; `AnswerRequest` includes nullable `response_decision_id` and `response_id` fields.

- Storage integration helpers `admissionLock(namespace, shared?)`, its `AdmissionBusy` error and `retryAdmission(transaction)` for admission transactions that return connections between lock attempts.
