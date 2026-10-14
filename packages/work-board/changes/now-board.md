### Changed

- Open Work on a Now board with fixed Fleet stage lanes, tasks only, one Fleet-derived state chip, and holder, PR and time in stage only when known. Disclose authored-status fallback when Fleet is unavailable; keep All work and Table as explicit choices. Queue prepared or approved waiting tasks, exclude inactive authored work, and collapse saved views and filters behind Filter on Now.
- Exclude decision, question, response, result and request receipt records from Work lists. Keep status column order independent of row sorting and virtualize lists over 200 rows in bounded scrolling containers.
