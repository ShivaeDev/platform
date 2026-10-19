---
"@shivaedev/work-board": patch
---

### Changed

- On item pages, screen readers and the Tab key reach the main content before the side panel with details and the outline. The layout on screen does not change.
- Goal sections link as `#progress`, `#criteria`, `#linked-work` and `#by-criterion`, so outline links and shared links keep working on every goal.
- Only Progress, Criteria, Linked work and the item context are named page regions. Link groups in the side panel are plain lists under headings.
- A plain Markdown file without front matter shows no empty Details card.

### Fixed

- Going back focuses the link that opened the page when that link is still there, and the page otherwise.
- An empty Details panel is no longer a Tab stop.
