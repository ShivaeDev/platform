---
"@shivaedev/quality": patch
---

### Fixed

- Remove untracked repository-root `.merge_file_*` leftovers older than five minutes when the baseline merge driver starts. Preserve the current merge's inputs, tracked files and recent files.
