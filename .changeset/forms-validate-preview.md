---
"@shivaedev/form": minor
"@shivaedev/work-board": patch
---

### Added

- `@shivaedev/form`: Form's `validate` atom reveals schema feedback and returns an encoded and decoded snapshot through the configured runtime without calling `onSubmit` or accepting the draft.

### Changed

- `@shivaedev/work-board`: Work Board validates answer and handoff previews through the form, showing errors instead of previewing invalid input.
