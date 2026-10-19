---
"@shivaedev/quality": patch
---

### Fixed

- Lint, fix and the pre-commit hook run Biome over every file of a linked worktree inside a `.worktrees` folder. The preset and the generated exception config exclude only the `.worktrees` folder at the root, because Biome also matched `!**/.worktrees` against the folders above the root and checked no file there.
- A Biome run that exits with a failure but reports no error finding, such as one whose config leaves no file to check, fails lint and fix with Biome's message instead of passing.
