---
"@shivaedev/work-board": minor
"@shivaedev/work-fleet": minor
---

### Added

- Validate scheduling areas against repository folders, suggest the nearest existing path for invalid areas, and refuse to dispatch invalid briefs.

### Breaking

- Scheduling areas that do not name existing folders are invalid. Replace free-text labels with package folder names, optionally followed by a folder inside its `src/`, or top-level repository folders. Use `*` for a repository-wide claim.
