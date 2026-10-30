---
"@shivaedev/heavy-lock": patch
---

### Fixed

- Accept an extra leading `--` so both `pnpm heavy <command>` and `pnpm heavy -- <command>` run under the lock. Show usage when no command follows the separator.
