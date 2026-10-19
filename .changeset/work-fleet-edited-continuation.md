---
"@shivaedev/work-fleet": patch
---

### Fixed

- Continuing work or answering a worker question approves the current task brief and includes edited criteria in the next worker turn. Edits approved after a finished turn remain queued across restarts.
- Continue retries concurrent storage changes during provider observation, and reconciliation leaves unchanged needs-human records untouched.
