### Changed

- Open Work on a Now board with fixed Fleet stage lanes, tasks only, one Fleet-derived state chip, and holder, PR and time in stage only when known. Disclose authored-status fallback when Fleet is unavailable; keep All work and Table as explicit choices. Queue Fleet-prepared or authored approved waiting tasks, use authored status only without a matching Fleet item, and collapse saved views and filters behind Filter on Now.
- Exclude decision, question, response, result and request receipt records from Work lists. Keep status column order independent of row sorting and virtualize lists over 200 rows in bounded scrolling containers.

### Fixed

- Let every available Fleet stage decide the task lane despite inactive authored statuses, including prepared and human-waiting work. Keep Done limited to known completions in the last seven days.
- Keep approved waiting tasks queued when Fleet addon fields are recognized without diagnostics.
