# @shivaedev/quality

Quality gives a repository an opinionated quality policy with sensible defaults, shared tool configuration and one gate. Adopt the policy instead of choosing rules and maintaining a complicated config; humans and agents can spend their time improving the code.

## Why you want this

A repository should not have to debate every lint rule, copy tool settings or decide which warnings an agent can ignore. Quality supplies the shared checks and repair guidance. The daily command is small:

```sh
quality lint
```

Built-in rules default to `error`, so an uncovered finding fails the gate and tells the author what to repair. An existing repository can record its debt in a baseline while keeping the checks strict: new findings above a file's recorded count fail, and fixing debt passes. You get one consistent standard without making every repository design it.

## Using it

### How to think about the gate

Adopt Quality's policy as a whole. Quality owns the shared rules, their defaults and the tool rules and fixes it deliberately disables internally. A repository supplies facts about its code and architecture; it does not need to choose a rule catalogue or warning levels.

A **rule** checks a repository and returns **findings**, each naming a file and what to change. Built-in rules run at `error` when their settings are omitted. A finding normally counts once; a limit rule counts how far the file exceeds its limit. Use the defaults and keep checks strict. The accepted configuration surface is wider than this adoption model; its severity and override behavior is described under [limits](#configuration-limits).

Two files explain findings the repository deliberately keeps:

- The **baseline** records existing debt by rule and file, as a maximum count. It makes strict checks usable before every file is cleaned up. `tighten` and `prune` lower the counts as debt disappears; explicitly writing a named rule again can raise them, and that diff needs review.
- The **registry** records permanent exceptions, each with a reason and optionally a finding's `subject`. A rule may refuse registry exceptions. An entry that no longer applies fails the gate instead of silently excusing future code.

The registry applies first, then the baseline. With the default rule settings, remaining findings fail in one report grouped by rule. A baseline entry with fewer findings left is a note, so removing debt passes immediately. An entry for an unknown or disabled rule fails; debt records must still name a check that runs.

The work has three parts: connect the repository to the shared tools once; describe an import boundary when its architecture needs one; run the gate and repair findings every day. Writing local rules is not an adoption requirement.

### 1. Once per repository: connect the shared policy

Put this in `quality.config.ts`:

```ts
import { defineConfig } from "@shivaedev/quality/config.ts";

export default defineConfig({
	preCommit: { run: ["pnpm typecheck"], tighten: true },
	sources: ["src"],
});
```

This supplies the source location and the repository's type-check command, while keeping Quality's rule settings at their defaults. The hook can also lower staged debt as it is repaired. The config's folder is the root for paths and commands. `sources` chooses the files the source rules read; a missing source stops the run. Directory discovery skips files ignored by git and the `.git` and `node_modules` directories. Some repository rules, such as manifest sorting, inspect the whole repository even when `sources` names only `src`.

`defineConfig` checks the config's types. The CLI also validates it: an unknown rule id fails before checks run, and enabled built-in rules reject unknown options. The [rule reference](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/rules.md) and [naming reference](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/naming.md) explain the shared checks. Their option inventory describes accepted inputs; you do not need to fill it out to adopt the policy.

Create a root `biome.json` too:

```json
{
	"extends": ["@shivaedev/quality/biome"]
}
```

Quality's `biome` rule asks for this shared configuration and reports Biome's error findings through the same baseline as the other rules. Quality ships the reasons for its own disabled Biome rules and selected disabled fixes. Extend it rather than copying the rule settings; record existing findings in the baseline instead of weakening the checks.

For an existing repository, inspect the report, record the debt it should keep and install the optional commit check:

```sh
quality lint
quality baseline write
quality hooks install
```

`baseline write` records error-level findings when there is no baseline. It refuses to regenerate an existing baseline without `--rule <id>`. `hooks install` writes the repository's pre-commit hook; the config above makes it tighten staged debt, run lint and then run `pnpm typecheck`. A hook Quality did not write is kept unless `--force` replaces it.

### 2. When architecture needs it: describe an import boundary

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

This adds a fact about the repository's architecture to the shared import check. It does not select a different set of Quality rules. Use real checked files and workspace package names in these chains. The illegal chain must cross this fence alone; the legal chain must cross none. `mayNotImport` checks direct imports; `mayNotReach` also follows repository imports transitively; `mayImportOnly(...subjects).of(unit)` permits only named modules or folders of a unit. Fences count type imports but never hold test files or files under `test-support/`. The [import reference](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/rules.md#imports) covers resolution, selectors and generated files.

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

`tighten` lowers entries for files changed since `HEAD`; `--staged` restricts those updates to staged files. `prune` considers every baseline entry. Both only lower or remove counts and can carry entries when git detects tracked moves. They count files on disk, so a manually run `tighten --staged` needs the unstaged changes stashed first. Quality's installed hook leaves partly staged files' entries for a later commit.

When a Quality upgrade adds a check, or a reviewed change needs to record one rule's findings again:

```sh
quality baseline write --rule tests/story-setup
```

Keep the default error level. The command replaces that rule's entries and leaves other rules' entries alone. Any new or raised count belongs in the review and the pull request's Callouts. The [debt and hook guide](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/debt-and-hooks.md) covers exception subjects, limit changes, renames and commit checks.

### API

Import names from their defining module; there is no root entry. The package's `./*.ts` export pattern also exposes the gate's implementation modules. The [module reference](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/modules.md) lists those exports; the following table lists the config, tool and extension entry points:

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
| `local` | `[]` | Exposed extension API for rules made with `defineRule`; not required for adoption. |
| `rules` | Every rule at `error` | Options by rule id, such as import boundaries. The API also accepts a level or `{ level, options }`; see configuration limits. |
| `preCommit` | `{ run: [], tighten: false }` | Additional shell commands after lint and optional staged baseline tightening. |

#### Local rules

The exposed local-rule API supplements the gate; a repository does not need to use it to get the shared policy. The [rule reference](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/rules.md#local-rule-api) gives complete extension examples. `defineRule` takes `id`, `description`, `check`, optional `options` and optional `registrable: false`. Its check receives `root`, checked paths in `files`, source files in `sources`, `readText(path)` and decoded `options`. A source file has `path`, `text` and editor-numbered `lines`; `readText` returns `undefined` for an absent file.

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
quality lint [--config <file>]
quality fix [--config <file>]
quality baseline write [--config <file>] [--rule <id>]...
quality baseline prune [--config <file>] [--against <ref>]
quality baseline tighten [--config <file>] [--staged]
quality baseline migrate [--config <file>] [--from <file>]
quality hooks install [--config <file>] [--force]
quality hooks uninstall
quality hooks pre-commit [--config <file>]
```

`quality` alone runs lint. The commands above use the default error-level policy. `prune --against` follows renames since the target's merge base; without a target it tries `origin/HEAD`, `origin/main`, then `origin/master`, and prunes without following moves when no merge base is available. An explicit target with unavailable history fails; fetch the needed history before rerunning. `migrate` converts a JSON baseline into the current JSON Lines format.

| Exit code | Meaning |
| --- | --- |
| `0` | Passed. Retained debt or loose baseline entries may remain; see the severity limitation below. |
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

#### Configuration limits

The public config accepts `warn` and `off` in `rules`, as a string or an object's `level`. An uncovered warning reports without failing, and an off rule does not run or validate its options. The CLI also accepts `--warnings summary|all`. These are accepted behaviors, not the recommended adoption path: omit levels and use the baseline for existing debt. The [roadmap](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/roadmap.md) owns the work to align this API with the whole-policy direction.

The consumer Biome-declaration API likewise allows a repository to weaken a tool check with a matching reason and scope. Biome findings below `error` are omitted from the gate. Keep the shared configuration rather than using these declarations to demote checks. The [rule reference](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/rules.md#declared-biome-overrides) describes what validation accepts; Quality's internally shipped exceptions are distinct from consumer choices.

Numeric rule limits and local-rule APIs are also exposed. They are not setup requirements. Use the shared defaults; repository-specific inputs such as source locations and fences supply information the policy needs.

- The gate checks static source policy. A successful import graph, fence example or test naming check does not prove an application's HTTP, database or browser behavior.
- The source inventory and Biome have their own scopes. `quality fix` runs Biome from the config's folder; it is not restricted to the source-rule inventory.
- The installed hook checks files on disk and uses each committing worktree's config and dependencies. It runs later commands after a reported lint failure or a nonzero command exit; a setup or process-launch failure stops the run.
- A pre-existing `core.hooksPath` decides which hook git runs. Quality keeps it and reports when its installed hook needs to be called from that hook.
- Import fences skip test code. Keep the tests honest through their real fixtures and review; use the registry only where the rule allows it.
