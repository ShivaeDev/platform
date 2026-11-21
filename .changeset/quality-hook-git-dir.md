---
"@shivaedev/quality": patch
---

### Fixed

- Quality run from a pre-commit hook that another hook manager wrote, in a linked worktree, leaves out the files that the `.gitignore` files above a source folder ignore, as a run from a shell does. Git hands such a hook `GIT_DIR` without `GIT_WORK_TREE`, and each git call from a source folder took that folder as the top of the work tree, so `quality lint` reported git-ignored build output and `quality baseline tighten` kept its debt. Quality now finds the top of the worktree once, also when the hook starts it in a package folder (as `cd app && quality lint` does), and keeps the hook's `GIT_DIR` and `GIT_INDEX_FILE`. A separate git dir that git does not find from the folder Quality starts in, such as a dotfiles repository, keeps that folder as the top, as git defines it. A hook no longer needs to clear `GIT_DIR` before it runs quality.
