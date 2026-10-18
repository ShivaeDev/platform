### Added

- `cli/messages.ts` exports `SUBCOMMANDS: Readonly<Record<string, string>>`, the usage hints for commands with subcommands.

### Changed

- Stale `adopt` and `preCommit` configuration keys and the `quality adopt` command now fail with the general unknown-key and unknown-command errors.
