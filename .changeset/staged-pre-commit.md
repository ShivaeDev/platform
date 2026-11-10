---
"@shivaedev/quality": minor
---

### Added

- `preCommit: "staged"` in `quality.config.ts` makes the pre-commit hook run only Biome's lint and format checks on the staged content of the staged files, skipping the full lint and the `typecheck` and `quality:commit` scripts. A Claude Code cloud session, where `CLAUDE_CODE_REMOTE` is `true`, still runs the full checks. Without the setting the hook is unchanged.
