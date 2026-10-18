### Fixed

- Answers, including guidance during execution or repair, and `answer --release` acknowledge their durable request before admission work, preserve queued-message order, keep status on automation while applying, and report recording failures instead of confirming an unsaved request.

- A dedicated receipt connection keeps answer recording, status and watch available when pending answers and reconciliations fill the admission pool.

- Reconciled clarification and deferral receipts keep later answers and releases applicable. Recovery deduplicates only the exact response published for the pending request.
