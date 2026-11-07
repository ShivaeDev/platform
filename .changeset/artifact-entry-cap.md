---
"@shivaedev/github": minor
---

### Added

- Artifact extraction accepts an inclusive `entryLimit` (default 10,000), counting files and directories and refusing excess entries with `GitHubArtifactTooManyEntries` before reading their contents.
