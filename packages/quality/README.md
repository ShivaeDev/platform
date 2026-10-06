# @shivaedev/quality

A repository can adopt strict checks without fixing all its old debt first. Quality gives its rules one typed config, one report, a baseline of existing findings and a registry of permanent exceptions with reasons, so an uncovered finding asks for a fix and a deliberate exception stays visible to review.

## Why you want this

Scattered lint commands, inline suppressions and rules left at warning make it hard to tell what a repository actually requires. Quality puts the checks behind one gate. Record the debt once, then run the same gate as the code changes:

```sh
quality baseline write
quality lint
```

The first command records the current error-level findings. The second passes while files stay within those counts and fails when a file gains uncovered error-level findings. Fixing debt passes too; the report notes the entries that can shrink. An agent gets the rule's guidance and the location to repair, while a reviewer sees any deliberate increase to the baseline in the diff.

## Using it

### How to think about the gate

A **rule** checks a repository and returns **findings**, each naming a file and what to change. A finding normally counts once; a limit rule counts how far the file exceeds its limit. The config gives each rule a level: `error` fails when uncovered, `warn` reports without failing, and `off` does not run the rule. Every rule starts at `error`.

Two files explain findings the repository deliberately keeps:

- The **baseline** records existing debt by rule and file, as a maximum count. It makes strict checks usable before every file is cleaned up. `tighten` and `prune` lower the counts as debt disappears; explicitly writing a named rule again can raise them, and that diff needs review.
- The **registry** records permanent exceptions, each with a reason and optionally a finding's `subject`. A rule may refuse registry exceptions. An entry that no longer applies fails the gate instead of silently excusing future code.

The registry applies first, then the baseline. The remaining findings become errors or warnings in one report, grouped by rule. A baseline entry with fewer findings left is a note; an entry for an unknown or disabled rule fails. The distinction matters: removing debt should pass immediately, while removing a rule should also remove its obsolete entries.

The work has three parts: configure the repository once; add a local rule or an import boundary when a feature needs a new policy; run the gate and repair findings every day.

### 1. Once per repository: choose the checked files and policy

Put this in `quality.config.ts`:

```ts
import { defineConfig } from "@shivaedev/quality/config.ts";

export default defineConfig({
	preCommit: { run: ["pnpm typecheck"], tighten: true },
	rules: {
		"comments/max-per-file": { options: { max: 3 } },
		"structure/max-lines": { options: { source: 200, testFiles: ["e2e/"] } },
	},
	sources: ["src", "script"],
});
```

The config's folder is the root for paths and commands. `sources` chooses the files the source rules read; a missing source stops the run. Directory discovery skips files ignored by git and the `.git` and `node_modules` directories. Some repository rules, such as manifest sorting, inspect the whole repository even when `sources` names only `src`.

Rule ids and options are checked by TypeScript through `defineConfig`. When the CLI loads the config, an unknown id fails before a check runs; enabled built-in rules also reject unknown options. Disabled rules skip option validation. A local rule's schema defines its option policy. See the [rule reference](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/rules.md) and [naming reference](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/naming.md) for the built-in policy and its options.

Create a root `biome.json` too:

```json
{
	"extends": ["@shivaedev/quality/biome"]
}
```

Quality's `biome` rule asks for this shared preset and reports Biome's error findings through the same baseline as the other rules. A repository that weakens a Biome setting declares the exact rule and scope with a reason in `suppressions/biome-overrides`; the [rule reference](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/rules.md#declared-biome-overrides) shows both sides of that declaration.

For an existing repository, inspect the report, record the debt it should keep and install the optional commit check:

```sh
quality lint
quality baseline write
quality hooks install
```

`baseline write` records error-level findings when there is no baseline. It refuses to regenerate an existing baseline without `--rule <id>`. `hooks install` writes the repository's pre-commit hook; the config above makes it tighten staged debt, run lint and then run `pnpm typecheck`. A hook Quality did not write is kept unless `--force` replaces it.

### 2. When the policy needs a rule: define it once

A local rule receives the checked source text and returns findings. This example is the same text-scanning rule exercised by the package's CLI tests:

```ts
import { defineRule } from "@shivaedev/quality/rule.ts";

export const noLog = defineRule({
	check: ({ sources }) =>
		sources
			.filter((file) => file.text.includes("console.log"))
			.map((file) => ({ file: file.path, message: "logs to the console." })),
	description: "Log through the logger.",
	id: "local/no-console-log",
});
```

It reports a file whose text contains `console.log`; it does not parse calls or distinguish a string from code. Use a syntax-aware check when the policy needs that distinction. Register it in the config:

```ts
import { defineConfig } from "@shivaedev/quality/config.ts";
import { noLog } from "./quality/noLog.ts";

export default defineConfig({ local: [noLog], sources: ["src"] });
```

`check` may return findings directly or asynchronously. For options, provide a [Standard Schema](https://standardschema.dev) validator; the check receives the decoded result. An absent options object is validated as `{}`, so defaults belong in the schema:

```ts
import { Effect, Schema } from "effect";
import { defineRule } from "@shivaedev/quality/rule.ts";

const Limit = Schema.Struct({
	max: Schema.Int.pipe(Schema.withDecodingDefaultKey(Effect.succeed(2))),
});

export const limited = defineRule({
	check: async ({ files, options }) =>
		files.length > options.max ? [{ file: ".", message: `${files.length} files exceed ${options.max}.` }] : [],
	description: "Keep the repository small.",
	id: "local/max-files",
	options: Schema.toStandardSchemaV1(Limit, { parseOptions: { onExcessProperty: "error" } }),
});
```

This is the option-bearing rule the package tests. It defaults to two files and validates a configured `max` before the asynchronous check runs. A rule without an options schema refuses options. Set `registrable: false` when a rule must never be excused by a registry entry.

### Declare an import boundary with examples

A **fence** is a prohibition on imports, with a reason and one illegal and one legal example. The rule validates the examples against the policy, so an accidental contradiction stops the run.

```ts
import { defineConfig } from "@shivaedev/quality/config.ts";
import { fence } from "@shivaedev/quality/imports/fences/dsl.ts";
import { external, folders, packages } from "@shivaedev/quality/imports/fences/selectors.ts";

const uiBoundary = fence("ui-never-imports-server")
	.because("The UI ships to browsers.")
	.from(folders("packages/ui/src"))
	.mayNotImport(packages("server"))
	.demonstratedBy({
		illegal: ["packages/ui/src/app.ts", "packages/server/src/db.ts"],
		legal: ["packages/ui/src/app.ts", external("effect")],
	});

export default defineConfig({
	rules: { "imports/fences": { options: { fences: [uiBoundary] } } },
});
```

Use real checked files and workspace package names in these chains. The illegal chain must cross this fence alone; the legal chain must cross none. `mayNotImport` checks direct imports; `mayNotReach` also follows repository imports transitively; `mayImportOnly(...subjects).of(unit)` permits only named modules or folders of a unit. Fences count type imports but never hold test files or files under `test-support/`. The [import reference](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/rules.md#imports) covers resolution, selectors and generated files.

### Story tests

Write setup in the domain kit under `test-support/` and keep each test specific to its story. [`@shivaedev/test-story`](https://github.com/ShivaeDev/platform/tree/main/packages/test-story#readme) explains how to build the kit, traits and verbs over a real engine.

Quality's `tests/story-setup` rule reports top-level test functions named with the words `seed`, `make`, `build` or `setup`, and fixture-writing calls imported from Node's `fs` or `fs/promises`. It leaves source and `test-support/` files alone. This is a check for those syntax patterns; a passing test file still needs review of what it tests.

### 3. Every day: repair findings and keep debt current

```sh
quality lint
quality fix
quality lint
```

Lint reports the rule's guidance and each finding's file and line when available. Fix sorts manifests, applies Biome's enabled lint fixes and formatting, then repeats until a round changes nothing, for at most five rounds. It applies unsafe lint fixes too, so review the diff. It leaves object key order and the preset's disabled fixes to the author; passing `fix` does not mean lint passes.

When you fix debt without the installed hook, lower the entries of changed files yourself:

```sh
quality baseline tighten
```

`tighten` checks files changed since `HEAD`; `--staged` restricts it to staged files. `prune` checks every entry. Both only lower or remove counts and can carry entries when git detects tracked moves. They count files on disk, so a manually run `tighten --staged` needs the unstaged changes stashed first. Quality's installed hook leaves partly staged files' entries for a later commit.

To adopt a new rule or deliberately record a rule's findings again:

```sh
quality baseline write --rule tests/story-setup
```

Set the rule to `error` first. The command replaces that rule's entries and leaves other rules' entries alone. Any new or raised count belongs in the review and the pull request's Callouts. The [debt and hook guide](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/debt-and-hooks.md) covers exception subjects, limit changes, renames and commit checks.

### API

Import names from their defining module; there is no root entry. The package's `./*.ts` export pattern also exposes the gate's implementation modules. The [module reference](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/modules.md) lists those exports; these are the modules a repository config normally uses:

| Module | Exports |
| --- | --- |
| `config.ts` | `defineConfig`, `QualityConfig`, `PreCommit`, `Level`, `RuleSetting`, `RuleSettings`, `BuiltInRules` |
| `rule.ts` | `defineRule`, `Rule`, `Configured`, `Finding`, `Findings`, `SourceFile`, `RuleInputs`, `RuleContext` |
| `standard-schema.ts` | `StandardSchemaV1`, `StandardResult`, `StandardIssue`, `describeIssue` |
| `imports/fences/dsl.ts` | `fence` |
| `imports/fences/selectors.ts` | `packages`, `folders`, `files`, `modules`, `scopes`, `anyOf`, `workspace`, `anything`, `external` |
| `imports/fences/model.ts` | `Fence`, `Target`, `Selector`, `Prohibition`, `Examples`, `Chain`, `ExampleStep`, `External` |
| `vitest.ts` | `testProjects`, `inheritTags` |
| `naming/testName.ts` | `testName`, `isTestCode`, `isTestSupport`, `ENVIRONMENTS`, `Environment`, `TestName` |

#### Config

| Key | Default | Meaning |
| --- | --- | --- |
| `sources` | `["."]` | Directories or files the source rules check, relative to the config. |
| `exclude` | `[]` | Paths outside the inventory, in `.gitignore` syntax. |
| `extensions` | `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs` | Source extensions. |
| `baseline` | `quality/baseline.jsonl` | Counts of existing findings. |
| `registry` | `quality/registry.json` | Permanent exceptions with reasons. |
| `local` | `[]` | Rules made with `defineRule`. |
| `rules` | Every rule at `error` | A level or `{ level, options }` by rule id. |
| `preCommit` | `{ run: [], tighten: false }` | Additional shell commands after lint and optional staged baseline tightening. |

#### Local rules

`defineRule` takes `id`, `description`, `check`, optional `options` and optional `registrable: false`. Its check receives `root`, checked paths in `files`, source files in `sources`, `readText(path)` and decoded `options`. A source file has `path`, `text` and editor-numbered `lines`; `readText` returns `undefined` for an absent file.

| Finding field | Meaning |
| --- | --- |
| `file` | Required. A path relative to the config root; an absolute path under it is made relative. |
| `message` | Required. What went wrong. |
| `line` | Optional. One-based source location. |
| `subject` | Optional. A stable name to distinguish exceptions within a rule and file. |
| `count` | Optional. Number of violations represented, one by default. |
| `threshold` | Optional. The limit the rule applied. |

A limit rule reports its amount over the limit as `count` and the limit as `threshold`. The built-in file-size and comment-count rules use that shape; the baseline stores the count.

#### Command line

```text
quality lint [--config <file>] [--warnings summary|all]
quality fix [--config <file>]
quality baseline write [--config <file>] [--rule <id>]...
quality baseline prune [--config <file>] [--against <ref>]
quality baseline tighten [--config <file>] [--staged]
quality baseline migrate [--config <file>] [--from <file>]
quality hooks install [--config <file>] [--force]
quality hooks uninstall
quality hooks pre-commit [--config <file>]
```

`quality` alone runs lint. Warnings are summarized by rule and busiest files; `--warnings all` lists each one. `prune --against` follows renames since the target's merge base; without a target it tries `origin/HEAD`, `origin/main`, then `origin/master`, and prunes without following moves when no merge base is available. An explicit target with unavailable history fails; fetch the needed history before rerunning. `migrate` converts a JSON baseline into the current JSON Lines format.

| Exit code | Meaning |
| --- | --- |
| `0` | Passed. Warnings or loose baseline entries may remain. |
| `1` | Failed: uncovered errors, stale registry entries or baseline entries for unknown or disabled rules. |
| `2` | Could not run: invalid input or config, missing files or git history, a failed rule, fixes that do not settle, or invalid usage. |

### Install, shared tooling and limits

```sh
pnpm add --save-dev @shivaedev/quality @effect/platform-node@4.0.0-rc.112 @effect/platform-node-shared@4.0.0-rc.112 effect@4.0.0-rc.112
```

Node 24 or later is required. The CLI loads the TypeScript config through Node's native import; use erasable syntax and `.ts` extensions for relative TypeScript imports. Installing the package does not install a hook; opt in with `quality hooks install`.

The package includes `@shivaedev/quality/biome`, `@shivaedev/quality/tsconfig/base.json` for type-checking, and `@shivaedev/quality/tsconfig/package.json` for emitted JavaScript, declarations and maps. The [shared tooling guide](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/tooling.md) explains their settings and complete configs.

For Vitest, install `vitest` and `happy-dom` when the repository has DOM tests, then use:

```ts
import { testProjects } from "@shivaedev/quality/vitest.ts";
import { defineConfig } from "vitest/config";

export default defineConfig({ test: testProjects({ exclude: ["e2e/**"] }) });
```

`testProjects` runs unit tests and specs in Node and `.dom` tests and specs in happy-dom by default. `.slow` tests run only when `--project slow` asks for them. Type tests are excluded from Vitest and belong in the compiler's input. The `exclude` globs keep another runner's suites out of all three projects.

#### Inherited tags

A root Vitest config that gathers inline projects from package configs uses `inheritTags(projects, root)` to copy the tags of each extended config into its project:

```ts
import { inheritTags } from "@shivaedev/quality/vitest.ts";
import { defineConfig } from "vitest/config";

const bakery = { extends: "./packages/bakery/vitest.config.ts", root: "./packages/bakery", test: { name: "bakery" } };

export default defineConfig(async () => ({
	test: { projects: await inheritTags([bakery], import.meta.dirname) },
}));
```

Vitest otherwise drops tags from an inline project's extended config. A project's own tag wins over an inherited tag with the same name; `extends: true`, globs and file-path projects stay unchanged. The [tooling guide](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/tooling.md#inherited-tags) gives the config-loading limits.

- The gate checks static source policy. A successful import graph, fence example or test naming check does not prove an application's HTTP, database or browser behavior.
- The source inventory and Biome have their own scopes. `quality fix` runs Biome from the config's folder; it is not restricted to the source-rule inventory.
- The installed hook checks files on disk and uses each committing worktree's config and dependencies. It runs later commands after a reported lint failure or a nonzero command exit; a setup or process-launch failure stops the run.
- A pre-existing `core.hooksPath` decides which hook git runs. Quality keeps it and reports when its installed hook needs to be called from that hook.
- Import fences skip test code. Keep the tests honest through their real fixtures and review; use the registry only where the rule allows it.
