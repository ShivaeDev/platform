### Fixed

- Answers, including guidance during execution or repair, and `answer --release` acknowledge their durable request before admission work, preserve queued-message order, keep status on automation while applying, and report recording failures instead of confirming an unsaved request.

- Answer recording, status and watch remain available when pending answers and reconciliations fill the admission pool.

- Reconciled clarification and deferral receipts keep later answers and releases applicable. Restarting the daemon during answer publication no longer duplicates an applied answer as guidance.

- Answers recorded for a waiting decision that becomes execution or repair guidance queue once across daemon restarts.
