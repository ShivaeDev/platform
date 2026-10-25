---
"@shivaedev/quality": patch
---

### Fixed

- Skip untracked files ignored through git's `info/exclude` or `core.excludesFile` during directory discovery, including in linked worktrees, while continuing to check tracked files.
