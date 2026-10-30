---
"@shivaedev/work-board": patch
---

### Fixed

- Reduce filesystem calls during full folder reads by resolving ordinary paths from cached canonical parents and sharing directory boundary checks for each index read. Symlinks, logical aliases and linked-directory boundaries retain their reading behavior; subsequent reads resolve paths afresh.
