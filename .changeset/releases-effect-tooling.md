---
"@shivaedev/releases": minor
---

### Breaking

- Return Effects from `parseChangeset`, `parseBody`, `computePlan`, `collectChangelog`, `decodePackage`, `planDiff` and `validateDiff`; yield these functions in an Effect program instead of calling them synchronously. Remove `requireThat` and `attempt`; fail directly with `ChangesetError` and use native Effect or Schema operations for fallible work. Provide `ChildProcessSpawner` alongside `FileSystem` for `readHistory` and `checkRepository`, or supply `NodeServices.layer` in Node applications.

### Fixed

- Keep release validation failures in the typed error channel, preserve original failures as non-enumerable causes, and report unsuccessful git commands as string-tagged `GitError` failures. Run git history reads through interruptible child processes and files through the Effect filesystem. Refuse a resolved base without common history instead of falling back to a different branch. Parse CLI commands with Effect CLI and reject unknown arguments with usage text while preserving plan output.
