---
"@shivaedev/quality": patch
---

### Changed

- When `quality hooks pre-commit` fails a lint, it repeats the findings after the output of the `typecheck` and `quality:commit` scripts, with each rule's count and its first three files, and the files of stale baseline or registry entries, just above the line that names the failed checks. A reader of the last lines of a failed commit sees what to fix without scrolling back to the lint report.
