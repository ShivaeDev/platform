---
"@shivaedev/releases": minor
---

### Breaking

- Attribute every bullet in multi-package changesets with a backticked package name and a colon, for example ``- `@scope/package`: Fix behavior.``. Plain bullets remain valid in single-package changesets. `parseChangeset` entries now include their owning `package`, and their `text` excludes the attribution prefix; consumers should select entries by `package` rather than treating every entry as shared.

### Fixed

- Collect only each package's attributed bullets in its changelog, release notes and migration checklist. Validate pre-1.0 bumps against that package's own sections. Render package sections and migration bullets through the same renderer.
- Accept adding attribution to legacy pending changesets while preserving their frontmatter and bullet wording; continue rejecting changes to existing owners and released history.
