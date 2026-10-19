---
"@shivaedev/work-fleet": patch
---

### Fixed

- Answers reach waiting workers when another Board read has already published the same decision question. Fleet reuses the registered question instead of conflicting with its registration timestamp.
- Decision source and question publication failures retain their underlying `cause` on `BoardFailure` and include its message in CLI and daemon diagnostics.
