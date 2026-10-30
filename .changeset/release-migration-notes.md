---
"@shivaedev/releases": minor
---

### Added

- Print a release migration checklist from `releases apply`, grouped by package with every Breaking entry, followed by new or stricter rules declared under `### Quality rules`. Each quality entry names its rule id and explains how consumers record or fix findings. Releases without either say so in one line.
- Export `collectMigrationNotes` and `collectReleaseNotes` from `releaseNotes.ts` so release PRs and GitHub releases can lead with the same checklist without a tracked migration document.

### Breaking

- `Section` and `Entry.section` from `sections.ts` now include `"Quality rules"` alongside the previous four sections. Add a `"Quality rules"` case to exhaustive section switches and records; keep each rule's id and adoption instructions in that section.
