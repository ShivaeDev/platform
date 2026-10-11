### Changed

- Quality uses its built-in defaults when `quality.config.ts` is absent. Existing configs still load and validate; a broken config or missing explicit `--config` path fails.
- The explicitly installed pre-commit hook runs lint, then the manifest's `typecheck` and `quality:commit` scripts when present. It uses the declared npm, pnpm, yarn or bun package manager, defaulting to npm.

### Breaking

- Removed `QualityConfig.preCommit` and the `PreCommit` type. Put extra repository checks in `package.json` as `quality:commit`; type checking is discovered from `typecheck`. Lower staged debt explicitly with `quality baseline tighten --staged`; the hook no longer changes or stages the baseline.
