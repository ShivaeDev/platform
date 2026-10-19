---
"@shivaedev/work-board": patch
---

### Fixed

- Search puts an exact title or ID match first, then other title and ID matches, ahead of open work that only mentions the words. An ID also matches by its last segment, so "answer card" finds `board.answer-card`.
- Search snippets show inline Markdown as plain text and mark the searched words.
- A result list cut short at 40 asks for more words or an ID.

### Added

- The empty search palette lists what needs you at the top, so Enter opens it.
