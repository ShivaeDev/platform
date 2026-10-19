---
"@shivaedev/work-board": patch
---

### Fixed

- Search lists each item once: a document's title and the passages under it now share the document's row instead of adding a second row for the title anchor.
- Search rows no longer repeat their title as the snippet; they show the next matching passage instead, or no snippet.

### Changed

- The search palette groups rows under **Go to**, **Appearance**, **Work** and **Documents** headings and drops the "command" subtitle from command rows.
- **Include Fleet records** in the palette sets the new optional `records` search option; the `records:` query prefix keeps working.
- The palette closes through the dialog's standard close control. The Search button is gone: Enter in the field still searches an unfinished query at once, and a failed search offers **Retry search**.
