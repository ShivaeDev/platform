---
"@shivaedev/changesets": patch
---

### Fixed

- Validate an in-progress merge against all incoming parents, including octopus merges, so releases already on main pass the commit hook while edits to released history still fail.
