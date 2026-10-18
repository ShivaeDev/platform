---
"@shivaedev/work-fleet": minor
---

### Fixed

- Answers, including guidance during execution or repair, and `answer --release` acknowledge their durable request before admission work, preserve queued-message order, keep answer status visible during provider-capacity waits, assign application failures to the orchestrator, and report recording failures instead of confirming an unsaved request. Pending answers resume automatically after transient completion-storage failures.

- Answer recording, status and watch remain available when pending answers and reconciliations fill the admission pool.

- Reconciled clarification and deferral receipts keep later answers and releases applicable. Restarting the daemon during answer publication no longer duplicates an applied answer as guidance.

- Answers recorded for a waiting decision that becomes execution or repair guidance queue once across daemon restarts.

### Changed

- The daemon opens one PostgreSQL connection beyond `database.maxConnections` to record answers and serve status and watch while admission is busy.
- Guidance sent during execution or repair now prints "Answer recorded; applying in the background" instead of "queued for the next turn".

### Breaking

- Host answer integrations pass `AnswerOptions` to `answerWork(host, workId, options)`; the answer-request apply callback receives `(workId, options)`.
