### Changed

- Open Work on a Now board with fixed Fleet stage lanes, tasks only, one Fleet-derived state chip, and holder, PR and time in stage only when known. Disclose authored-status fallback when Fleet is unavailable; keep All work and Table as explicit choices. Queue prepared or approved waiting tasks, exclude inactive authored work from Queued and Waiting on a person, and collapse saved views and filters behind Filter on Now.
- Exclude decision, question, response, result and request receipt records from Work lists. Keep status column order independent of row sorting and virtualize lists over 200 rows in bounded scrolling containers.

### Fixed

- Keep tasks visible in their live Fleet execution, review or delivery lane when their authored status is already done, completed or otherwise inactive.
- Keep approved waiting tasks queued when Fleet addon fields are recognized without diagnostics.
