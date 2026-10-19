---
"@shivaedev/work-board": patch
---

### Added

- **Find documents** on Library keeps the documents whose title or ID contains every typed word, as Now's **Find work** does. `library.query` accepts the same text as an optional `query`.

### Changed

- Library keeps its text, kind, status, view and **Include files Fleet writes** choice in the URL, so Back, reload and a shared link reopen the same list. It used to reset to all documents by title.
- Library opens on Recently changed and renders the first 100 rows with a count of all matches. **Show more** adds the next 100, and Back from a document returns to the same rows.
- Library's Kind and Status filters use the same compact controls as Now.
