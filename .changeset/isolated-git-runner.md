---
"@shivaedev/test-story": minor
---

### Added

- `isolatedGit(cwd, args, handed?)` from `@shivaedev/test-story/server/adapters/isolatedGit.ts` runs git for a story kit without the developer's global or system git configuration and without the `GIT_DIR`, `GIT_INDEX_FILE`, `GIT_CONFIG_PARAMETERS`, author and committer variables that a git hook running the tests exports. Variables a kit hands it apply after the isolation. `isolatedGitCommand(command, handed?)` and `isolatedGitEnvironment(handed?)` give the same isolation to a program under test as an `env` command line or as environment variables.
