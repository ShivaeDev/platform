# Changelog

## 0.2.0 - 2026-09-28

### Changed

- **Breaking:** Take `effect`, `@effect/platform-node` and
  `@effect/platform-node-shared` as peer dependencies pinned to exact versions
  instead of dependencies, so an install holds one copy of Effect. pnpm, npm
  and Bun install them with the package. Migrate a repository that depends on
  Effect to the pinned versions, 4.0.0-rc.112, before upgrading.

### Fixed

- Pin `@effect/platform-node-shared` to the `effect` version, so the `quality`
  command starts after a fresh install. Before, `@effect/platform-node` resolved
  a newer `@effect/platform-node-shared` prerelease than its `effect`, and the
  command crashed on start importing modules that `effect` lacks.

## 0.1.1 - 2026-09-26

### Changed

- Load only the Node modules the `quality` command uses, so it starts in about
  half the time.

## 0.1.0 - 2026-09-26

### Added

- Add the `quality` command line: `lint` runs every rule and prints one report
  grouped by rule, `baseline write` records existing violations and
  `baseline prune` drops fixed debt. It exits 0 when the gate passes, 1 when it
  fails and 2 when it cannot run.
- Add `defineConfig` for a typed `quality.config.ts`: sources, exclusions in
  `.gitignore` syntax, a level and typed options per rule, and repository rules.
  The config is validated when loaded, and every rule defaults to `error`.
- Add `defineRule` for repository rules, with options declared by any Standard
  Schema.
- Add the shrink-only baseline: a baselined file may not gain violations or grow
  past its measure, and an entry that allows more than is left fails until it is
  pruned. Existing baselines adopt a new rule only by name.
- Add the registry of permanent exceptions: each entry names a rule, a file,
  optionally a subject, and a reason, and an entry that covers nothing fails.
- Add `structure/max-lines`: 150 lines per source file and 300 per test file by
  default, with configurable limits and test patterns.
