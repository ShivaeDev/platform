---
"@shivaedev/github": minor
---

### Added

- Add `details(summary, text)` to render raw text with escaped HTML and Markdown in both the summary and body.
- Add `renderSections` to share one UTF-8 byte budget across row lists, reserving headers and an `and N more` paragraph for each truncated section.

### Breaking

- `renderRows` now returns `Result<string, MarkdownBudgetTooSmall>` instead of a string or a thrown `RangeError`. Match the native Effect `Result` with `Result.match`, or convert it with `Effect.fromResult`. Budget failures carry the requested `byteLimit`; import `MarkdownBudgetTooSmall` from `@shivaedev/github/errors.ts`.
