# Changelog

## 0.3.0 - 2026-10-03

### Added

- Add comment rules, each an error by default: `comments/no-jsdoc` (with an
  `allow` list of tool pragmas such as `@vitest-environment`),
  `comments/no-line-reference`, `comments/no-pr-reference`, `comments/no-banner`,
  `comments/no-todo` and `comments/max-per-file` (2 comments per file by
  default; a block comment or a run of adjacent line comments counts once, and
  pragmas and directives are not counted). They find comments with the
  TypeScript parser, so strings, template literals, regular expressions and JSX
  text never count.

- Add suppression rules, each an error by default:
  `suppressions/no-inline` reports every comment directive that silences a
  linter, the compiler or a formatter (`biome-ignore…`, `@ts-ignore`,
  `@ts-expect-error`, `@ts-nocheck`, `eslint-disable…`, `prettier-ignore` and
  their equivalents for Oxlint, Stylelint, Deno, TSLint and Flow), in
  TypeScript and JavaScript modules and in CSS, SCSS and Less files, except
  `@ts-expect-error` in type-test files the config declares with a reason;
  `suppressions/no-double-cast` reports casts through `unknown`, `any` or
  `never`; `suppressions/biome-overrides` reports a Biome setting that turns a
  lint rule, group, domain, assist action, the linter, the assist or the
  formatter off or down, per language too, or keeps files out of a check
  through an `includes` list, unless the quality config declares it with its
  rule, its `includes` and a reason. Both rules report a declaration that
  matches nothing. Coverage hints stay allowed.

- Add `quality baseline check [--against <ref>]`, which compares the baseline
  with its version at the merge base of `HEAD` and the target branch
  (`origin/HEAD`, `origin/main` or `origin/master` by default) and fails when it
  gained an entry, a higher `count`, or a rule baselined for the first time. Comparing with the merge base means a branch that is behind never
  fails. An entry whose file git sees as moved is compared with its old path. It
  exits 2 without a git work tree, a target or a merge base, and says to fetch
  more history in a shallow clone.

- Add the `adopt` config key: a rule enters the baseline for the first time only
  while `adopt` names it, so the adoption shows in the config's diff. The check
  fails when `adopt` names a rule with nothing baselined.

- Add `quality baseline tighten [--staged]`, which lowers and removes the
  entries of the files changed since `HEAD`, or staged for the next commit, and
  leaves every other line as it is. Run it in a pre-commit hook and stage the
  baseline again.

- Add `quality baseline migrate [--from <file>]`, which moves a baseline from
  the earlier JSON format to the configured file. An old entry that stored a
  size becomes that size less the rule's current limit, and an entry whose file
  is now within the limit is dropped.

- `quality baseline prune` and `tighten` carry the entry of a file that git
  sees as moved to its new path, at the lower of its old count and what the
  file has now.

- Add `registrable: false` to `defineRule`, for a rule the registry must never
  excuse. The suppression rules set it, so a registry entry that names one fails
  the gate as stale; existing suppressions are adopted through the baseline.

### Changed

- **Breaking:** The baseline is a JSON Lines file, `quality/baseline.jsonl` by
  default, with one entry per line (`{"path":…,"rule":…,"count":…}`) sorted by
  path and then rule. `count` is the number of violations; for a rule with a
  limit, such as `structure/max-lines` or `comments/max-per-file`, it is the
  amount over the limit, so changing a limit shifts every count of the rule. A
  repository with a `quality/baseline.json` fails to run until it runs
  `quality baseline migrate`.

- **Breaking:** A finding reports `count` (the violations it stands for, 1 by
  default) and `threshold` (the limit it applied) instead of `measure`. A local
  rule that set `measure` reports the amount over its limit as `count`.

- `quality baseline write --rule <id>` records a rule that the baseline already
  covers again, replacing its entries, for example after a limit change.
  `quality baseline check` fails on any entry this raises.

- `quality lint` passes a baseline entry that allows more than is left,
  including a file with no violations left, and lists it as a note. An entry for
  a rule that is off or unknown still fails.

- `quality baseline write --rule` and `prune` rewrite only the lines they add,
  lower or remove, and never re-sort or reformat the rest.

- **Breaking:** The comment rules are on by default, so upgrading fails a
  repository with existing comment violations until it fixes them or adopts the
  rules with `quality baseline write --rule <id>`.

- **Breaking:** The suppression rules are on by default, so upgrading fails a
  repository with inline suppressions, double casts or undeclared Biome
  overrides until it fixes them, declares its Biome overrides, or adopts the
  rules with `quality baseline write --rule <id>`.

- Comment rules also skip the Oxlint, Stylelint, Deno, TSLint and Flow
  directives, like the other compiler and linter directives.

- Depend on `typescript`, resolved to the TypeScript 6 compiler API, to find
  comments.

- Remove the JSDoc from the package's own source; the README documents the
  config, rule and finding fields.

- Consolidate duplicate test cases around observable package behavior.

- Validate packed consumers and executable bins through the shared workspace gate.

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
