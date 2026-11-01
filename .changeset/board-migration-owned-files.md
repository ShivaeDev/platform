---
"@shivaedev/work-board": patch
---

### Fixed

- Migrate only workspace-owned Markdown selected by the scanner, leaving dependency folders, hidden folders and outside reference files unchanged and avoiding ancestor symlink loops.
