# Changelog

## 0.6.0 - 2026-10-04

### Added

- Add `imports/aliased`. A relative import may name only a file in its own folder; one that goes up (`../format.ts`) or down into a subfolder (`./parts/deeper.ts`) is reported, in static imports, re-exports, side-effect imports, `import()`, `require()`, `import()` types, JSDoc `@import` tags and the paths of `vi.mock` and its kin. Each finding names the alias that replaces it, from the importer's `package.json` `imports`, its tsconfig `paths` or another workspace package's `exports`, or asks for an alias when none reaches the file. Like every rule it is an error by default, so a repository that upgrades adopts it into its baseline or runs `quality fix`.

### Changed

- `quality fix` first rewrites each import `imports/aliased` reports to the alias that resolves to the same file, then sorts the manifests and runs Biome, so Biome sorts the rewritten imports. Across workspace packages it prefers an alias of the importer's `package.json`, then the other package's name as its `exports` allow, then a tsconfig path; otherwise the most specific alias wins. It leaves an import the registry excuses, and does nothing while the rule is off.
- The Biome preset organizes imports in five groups: Node and Bun builtins, packages, `@shivaedev/*` packages, aliases (`#…`, `@/…`, `~…`) and relative paths. `quality fix` regroups the imports of every file once; until then each file out of order is a `biome/assist/source/organizeImports` finding.

## 0.5.1 - 2026-10-04

### Changed

- `quality fix` applies only changes that keep behavior: it sorts every `package.json` and applies Biome's formatting and assist actions, such as organized imports and sorted keys. Biome's safe lint fixes, which can change behavior (for example, `noProcessGlobal` adds `import process from "node:process"`, which a browser bundle cannot load), are applied only with the new `quality fix --lint`.

### Fixed

- `quality fix` no longer hangs. Biome 2.5.14 never finishes applying the safe fix of `noProcessGlobal` to `globalThis.process`, so `quality fix` ran without end on any repository with that code. It no longer applies lint fixes by default; `quality fix --lint` still runs into this Biome bug.

## 0.5.0 - 2026-10-04

### Added

- Add the Biome preset `@shivaedev/quality/biome`. It sets the formatting (tabs, a line width of 150, double quotes), every rule Biome recommends at `error`, a list of stricter rules such as `noUnsafeTypeAssertion`, `useBlockStatements`, `noEqualsToNull`, `useConsistentArrayType` with `readonly T[]`, `noFloatingPromises` and `useExhaustiveSwitchCases`, sorted keys in JSON and object literals, and the GritQL plugins that ban ambient time, randomness, `console` and `process.env` and check `Effect.fn` span names. Its `declarations.json` declares the rules it turns off.
- Add the `biome` rule. It runs Biome, now a dependency pinned to 2.5.14, and reports each finding as `biome/<category>`, so Biome's findings take part in the baseline. `adopt: ["biome"]` adopts all of them. It also asks for a root Biome config that extends the preset. Like every rule it is an error by default, so a repository that upgrades extends the preset and adopts `biome` into its baseline.
- Add `quality fix`, which sorts every `package.json` and applies Biome's safe fixes, assist actions and formatting.
- Add the `manifests/sorted` rule. It reports every `package.json` in the repository whose keys are not in the order of sort-package-json, now a dependency pinned to 4.0.0, and every `package.json` that is not valid JSON.
- Add `@shivaedev/quality/vitest`. Its `testProjects()` sets up Vitest projects by file name: `unit` runs `*.test.ts` files in Node, `dom` runs `*.dom.test.ts` and `*.dom.test.tsx` files in happy-dom, and `slow` runs `*.slow.test.ts` files only when `--project slow` asks for it. Type tests (`*.typecheck.test.ts`) never run. `vitest` is an optional peer dependency.
- Add `comments/no-environment-pragma`, which reports a test environment set by a Vitest or Jest environment pragma. A DOM test is named `*.dom.test.ts` instead.
- Add `imports/cycles` and `imports/resolvable`, which read the import graph of the sources with the TypeScript compiler. `imports/cycles` reports each group of modules that import each other at run time, ignoring type-only imports, and takes no registry exceptions. `imports/resolvable` reports an import that resolves to nothing; its `generated` option names the folders where a relative import of a missing file is generated output. Like every rule they are errors by default, so a repository that upgrades baselines what they find. A run whose sources hold no module fails instead of passing on an empty graph.
- Add `imports/fences` and the `fence()` builder for declaring import fences in the config without patterns: `fence(name).because(reason).from(target)` with `mayNotImport`, `mayNotReach` or `mayImportOnly(...).of(...)`, demonstrated by an illegal and a legal example that the rule checks against the policy. Targets are `packages`, `folders`, `files`, `modules`, `scopes`, `anyOf`, `workspace` and `anything`, each with `.except`, and every name must exist.

### Changed

- `suppressions/no-inline` allows `@ts-expect-error` in type tests by their file name, `*.typecheck.test.ts` or `typecheck.test.ts`, and takes no options. The `declared` option is gone, so a config that sets it fails to load until it is removed.
- The `allow` lists of `comments/no-jsdoc` and `comments/max-per-file` are empty by default, so a tool pragma counts as a comment until the config allows its tag.

### Fixed

- Write all of a long report before exiting when the output is a pipe, instead of cutting it off.

## 0.4.0 - 2026-10-03

### Added

- `suppressions/biome-overrides` follows `extends` entries that name a package,
  such as a shared Biome preset, resolved from the root's `node_modules` through
  `exports` (the `biome` and `default` conditions and `*` patterns), `main` or a
  file inside the package, as Biome resolves them. A non-relative entry that
  names a file at the repository root is read as that file. The weakenings a
  preset makes count as declared when a `declarations.json` beside the preset
  declares them; any other preset weakening is reported at the `extends` line.
  A repository declaration that repeats one the preset ships is reported, and so
  is an `extends` entry that cannot be resolved or read.
- Add tsconfig presets for TypeScript 7. `@shivaedev/quality/tsconfig/base.json` is for type-checking with `noEmit`. `@shivaedev/quality/tsconfig/package.json` is the base plus declaration output, declaration and source maps, and relative `.ts` imports rewritten to `.js`, for building a package. The base sets `target` and `lib` to ESNext with bundler resolution; type-checks JavaScript with `allowJs` and `checkJs`; turns on `strict` (stating `noImplicitAny` and `strictBuiltinIteratorReturn` explicitly), `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `isolatedModules`, `erasableSyntaxOnly`, `noUncheckedSideEffectImports` and `forceConsistentCasingInFileNames`; and rejects unreachable code and unused labels. Dot access to index signatures stays allowed.

### Changed

- `suppressions/biome-overrides` merges a config with the configs it extends the
  way Biome does: a later setting of a rule, a group, `recommended` or `enabled`
  replaces an earlier one, so a weakening that the extending config sets back to
  `error` is no longer reported, while `overrides` and every `includes` list are
  appended. The `extends` of an extended config are no longer followed, since
  Biome does not apply them.

## 0.3.1 - 2026-10-03

### Changed

- `quality baseline check` fetches the full history with `git fetch --unshallow`
  when a shallow clone does not reach the merge base, and looks for it again
  before it exits 2. The fetch never stops to ask for a
  password.

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
