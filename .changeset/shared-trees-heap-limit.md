---
"@shivaedev/quality": minor
---

### Added

- A rule can declare `needs: "type-checker"` when it builds a TypeScript program of its own. A run checks those rules before its syntax rules, so their programs are gone before the run keeps one syntax tree per source.

### Changed

- Every syntax rule in a run and the story program read one shared tree per source instead of parsing each source again. The trees are created after the type-checking rules and released at the end of the run. Findings do not change.
- The `quality` executable runs under a heap limit that it sets itself, so no script passes a Node flag: 2048 MB for a fast lint and 3072 MB for a run of every rule (a lint or pre-commit hook in CI, in a cloud session or with `--full`, and `fix`, `baseline` and `exceptions`). A run that reaches the limit exits with `2` and a last line naming the limit and how to raise it; a limit set through `NODE_OPTIONS=--max-old-space-size=<megabytes>` is kept as it is.
