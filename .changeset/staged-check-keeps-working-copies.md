---
"@shivaedev/quality": patch
---

### Fixed

- The `preCommit: "staged"` hook can no longer lose a file edited after staging. It stores the working copy in git's object database and prints the commands that recover it before writing the staged content in place, puts every copy back even when writing the staged content fails part way, puts back the others when one copy cannot be restored and names that one, and keeps symlinks, unstaged mode changes and deletions as they were.
