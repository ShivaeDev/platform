# @shivaedev/quality

Quality gives a repository an opinionated quality policy with sensible defaults, shared tool configuration and one gate. Adopt the policy instead of choosing rules and maintaining a complicated config; humans and agents can spend their time improving the code.

## Why you want this

A repository should not have to debate every lint rule, copy tool settings or decide which warnings an agent can ignore. Quality supplies the shared checks and repair guidance. The daily command is small:

```sh
quality lint
```

Built-in rules run at `error`, so an uncovered finding fails the gate and tells the author what to repair. An existing repository can record its debt in a baseline while keeping the checks strict: new findings above a file's recorded count fail, and fixing debt passes. You get one consistent standard without making every repository design it.

## Using it

### How to think about the gate

Adopt Quality's policy as a whole. Quality owns the shared rules, their defaults and the tool rules and fixes it deliberately disables internally. A repository supplies facts about its code and architecture; it does not need to choose a rule catalogue or warning levels.

A **rule** checks a repository and returns **findings**, each naming a file and what to change. Built-in and local rules always run at `error`. A finding normally counts once; a limit rule counts how far the file exceeds its limit. Use the defaults and keep checks strict. The config rejects warning levels, disabled rules, raised thresholds and inventory exclusions.

Two records explain findings the repository deliberately keeps:

- The **baseline** records existing debt by rule and file, as a maximum count. It makes strict checks usable before every file is cleaned up. `tighten` and `prune` lower the counts as debt disappears; explicitly writing a named rule again can raise them, and that diff needs review.
- The config's **exceptions** list records permanent exceptions once, each with files, rules, a reason and optionally a Quality finding's `subject`. One declaration covers both Quality and Biome rules. A rule may refuse exceptions. An entry that no longer applies fails the gate instead of silently excusing future code.

Exceptions apply first, then the baseline. With the default rule settings, remaining findings fail in one report grouped by rule. A baseline entry with fewer findings left is a note, so removing debt passes immediately. An entry for an unknown or disabled rule fails; debt records must still name a check that runs.

The work has three parts: connect the repository to the shared tools once; describe an import boundary when its architecture needs one; run the gate and repair findings every day. Writing local rules is not an adoption requirement.

### 1. Once per repository: connect the shared policy

A new repository needs no `quality.config.ts`. Quality checks sources from the current directory with every built-in rule at its default error level. The default baseline path is `quality/baseline.jsonl`; permanent exceptions belong in `quality.config.ts`.

Create a root `biome.json`:

```json
{
	"extends": ["@shivaedev/quality/biome"]
}
```

Quality's `biome` rule asks for this shared configuration and reports Biome's error findings through the same baseline as the other rules. Quality ships the reasons for its own disabled Biome rules and selected disabled fixes. Extend it rather than copying the rule settings; record existing findings in the baseline instead of weakening the checks.

Add the daily commands to `package.json`:

```json
{
	"scripts": {
		"format": "quality fix",
		"lint": "quality lint",
		"typecheck": "tsc --noEmit"
	}
}
```

The optional pre-commit hook runs Quality's lint, then the `typecheck` script when it exists, then an optional `quality:commit` script for repository checks. It uses the manifest's `packageManager` (`npm`, `pnpm`, `yarn` or `bun`), defaulting to `npm` when omitted. Add `quality:commit` only when the repository has extra commit checks.

Inspect the report and install the optional commit check explicitly:

```sh
quality lint
quality hooks install
```

Installing the package does not install a hook. `hooks install` writes the repository's pre-commit hook. A hook Quality did not write is kept unless `--force` replaces it. For an existing repository, `quality baseline write` records error-level findings when there is no baseline; it refuses to regenerate an existing baseline without `--rule <id>`.

Add a config only when the repository needs to supply facts such as source locations or import boundaries:

```ts
import { defineConfig } from "@shivaedev/quality/config.ts";

export default defineConfig({ sources: ["src"] });
```

When a config exists, its folder is the root for paths and hook scripts. Without one, the current directory is the root. `sources` chooses the files the source rules read; a missing source stops the run. Directory discovery skips untracked files ignored by git and the `.git` and `node_modules` directories. Tracked files remain checked even when an ignore pattern matches them; a folder named `generated/` does not exempt authored code. Some repository rules, such as manifest sorting, inspect the whole repository even when `sources` names only `src`.

`defineConfig` checks the config's types. The CLI also validates it: a broken config, unknown rule id or invalid options fails before checks run. An explicit `--config` path must exist.

### 2. When architecture needs it: describe an import boundary

An app says where its code runs through folder names. A package adopts the runtime convention by having `src/client/` or `src/server/`; no config entry is needed. In that package, `src/client/` is browser code, `src/server/` is server code, and everything else is shared except package-root tooling. Keep shared code wherever its topic belongs; there is no required `src/shared/` folder or runtime file suffix.

`imports/runtime` rejects client imports of server code or Node built-ins. Shared code may import neither client nor server code, use browser globals such as `window`, `document` or `localStorage`, or import Node built-ins. Both client and server code may import shared code. The check includes type imports and re-exports and resolves aliases through the shared import graph. Locally bound names and property names are not browser globals; portable web APIs such as `URL`, `fetch` and `AbortController` remain available to shared code. Test files and `test-support/` ship nowhere and are outside this runtime policy.

A package with a nonempty `bin` entry and no runtime folders is server code throughout. Runtime folders take precedence when a package also ships browser code. A Node library without a CLI uses `src/server/`; `engines.node` alone does not say that a package is Node-only. Packages without runtime folders or a `bin` entry retain their existing source policies. Existing explicit fences continue to run in every package. Runtime folders are detected independently of `sources`, including empty folders; `sources` still selects the code that is checked.

Tooling is server code in every package, including the workspace root: files under its top-level `script/`, `scripts/` and `tooling/` folders, and top-level JavaScript or TypeScript config files such as `vitest.config.ts`. A tooling folder or config file nested under `src/` follows the source runtime policy. Browser and shared code cannot import package-root tooling.

The manifest owns ordinary workspace dependencies. When a package promises more, put `quality.fences.config.ts` beside its `package.json`, exporting an array of fences as the default. Quality discovers this file at the repository root and in workspace packages, even when `sources` includes only their source folders. The root config does not list boundary files.

A **fence** is a prohibition on imports, with a reason and one illegal and one legal example. Quality validates all discovered fences together, so duplicate names or contradictory examples stop the run. An unreadable file or invalid default export also stops the run. Fences remain an internal `imports/fences` module of Quality and use its shared import graph, resolver and report.

```ts
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

export default [uiBoundary];
```

This is `packages/ui/quality.fences.config.ts`; paths remain relative to the repository root. Existing fences supplied through `rules["imports/fences"].options.fences` join the same policy. This adds a fact about the repository's architecture to the shared import check. It does not select a different set of Quality rules. Use real checked files and workspace package names in these chains. The illegal chain must cross this fence alone; the legal chain must cross none. `mayNotImport` checks direct imports; `mayNotReach` also follows repository imports transitively; `mayImportOnly(...subjects).of(unit)` permits only named modules or folders of a unit. Fences count type imports but never hold test files or files under `test-support/`. The default `imports/no-test-code` rule rejects production imports of either, including type imports and re-exports. Move shared code into a production module that tests can import.

The import rules resolve every literal specifier the way the TypeScript compiler does, with the nearest `tsconfig.json`, and stop the run when the sources hold no module at all. A relative or `#` import of a file that a generator writes before the tests run resolves only inside a folder that `imports/resolvable` lists as `generated`; the folder, or every file an import names in it, must be ignored by git:

```ts
import { defineConfig } from "@shivaedev/quality/config.ts";

export default defineConfig({
	rules: { "imports/resolvable": { options: { generated: ["packages/db/src/test-support/generated"] } } },
});
```

### Story tests

Write setup in the domain kit under `test-support/` and keep each test specific to its story. [`@shivaedev/test-story`](https://github.com/ShivaeDev/platform/tree/main/packages/test-story#readme) explains how to build the kit, traits and verbs over a real engine.

Quality's `tests/story-specs` rule reports a test file that declares tests without a kit's `it`, including plain Vitest `it` and `test` declarations mixed with stories. Typecheck tests are exempt, as are test-story itself and its transitive workspace dependencies, including development, optional and peer dependencies: requiring those packages to depend on test-story would create a cycle. Pure-function tests are included: the baseline records existing files, and that debt should only go down.

Every package tests its real engine through its own story kit, so setup and actions share the package's domain vocabulary. To repair a finding, build the kit with `storyKit` from `@shivaedev/test-story/storyKit.ts` in `src/test-support`, import it in the spec and replace plain registrations with `kit.it(name, traits, body)`. The rule follows imports, aliases and conditional registrars back to the kit; it checks declarations, while review and runtime tests establish whether the kit exercises the real engine.

Quality's `tests/story-setup` rule reports top-level test functions named with the words `seed`, `make`, `build` or `setup`, and fixture-writing calls imported from Node's `fs` or `fs/promises`. It leaves source and `test-support/` files alone. This is a check for those syntax patterns; a passing test file still needs review of what it tests.

### 3. Every day: repair findings and keep debt current

```sh
quality lint
quality fix
quality lint
```

Lint reports the rule's guidance and each finding's file and line when available. Fix sorts manifests, applies Biome's enabled lint fixes and formatting, then repeats until a round changes nothing, for at most five rounds. It applies unsafe lint fixes too, so review the diff. It leaves object key order and the preset's disabled fixes to the author; passing `fix` does not mean lint passes.

When you fix debt, lower the entries of changed files:

```sh
quality baseline tighten
```

`tighten` lowers entries for files changed since `HEAD`; `--staged` restricts those updates to staged files. `prune` considers every baseline entry. Both only lower or remove counts and can carry entries when git detects tracked moves.

When a Quality upgrade adds a check, or a reviewed change needs to record one rule's findings again:

```sh
quality baseline write --rule tests/story-setup
```

Keep the default error level. The command replaces that rule's entries and leaves other rules' entries alone. Any new or raised count belongs in the review and the pull request's Callouts. The [debt and hook guide](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/debt-and-hooks.md) covers the baseline format, exception subjects, limit changes, renames and commit checks.

### What the rules check

`quality lint` prints each failing rule's guidance with its findings, so the finding is the reference for what to change. The built-in rules fall into these groups:

- **Structure:** `structure/max-lines` allows 150 lines in a source file and 300 in test code, `nesting/max-depth` rejects lines indented eight tabs deep, and `structure/no-barrel` rejects `index` modules. The preset rejects every re-export, types included; when `noExportedImports` suggests `export … from`, import the name where it is used instead. A module does one job.
- **Comments:** the `comments/*` rules reject JSDoc, TODOs, banners, line and pull request references, environment pragmas and more than two comments per file. A comment says why, never what the code already says or what it used to be. A tool pragma such as `@jsxImportSource` counts as a comment until both `comments/no-jsdoc` and `comments/max-per-file` list its tag in their `allow` option.
- **Suppressions:** the `suppressions/*` rules reject inline lint and compiler directives, casts through `unknown`, `any` or `never`, Biome settings that weaken a check, recommended Biome rules the preset leaves below `error`, and `ignoreDeprecations`. None of them takes exceptions. A type test (`*.typecheck.test.ts`) may use `@ts-expect-error`; a test that must pass a rejected value at run time calls the API through `Reflect.apply`.
- **Imports:** cycles, unresolvable imports, workspace imports missing from the manifest, relative imports that leave their folder, production imports of test code, runtime folders and fences, as described above.
- **Names and files:** the Biome preset's naming rules and plugins, and the `files/*` rules, which name a file after its main export with its folders as the prefix. No naming rule renames anything; the author picks the name. A name an outside system owns, such as a query parameter or an environment variable, is written as a quoted key, which the naming rules skip. A `Schema.Struct` field stays camelCase even when quoted and maps to the outside name with `Schema.encodeKeys`. Biome's naming messages print only a pattern: spell acronyms as words (`HttpClient`, `userId`, `parseUrl`) rather than turning off `strictCase` as its hint suggests, give a type no `I` prefix, and name a type parameter `T`, `T` plus a PascalCase name (`TItem`), or Effect's `A`, `E` and `R`. No rule checks these, so review does: a boolean reads as a question (`isOpen`, `canRetry`) unless the DOM or React names it (`open`, `disabled`); a schema shares its name with its type (`type Item = typeof Item.Type`); an unused parameter is removed rather than renamed with the `_` prefix TypeScript accepts. The naming rules take repository facts: `toolOwned` lists `.gitignore` patterns whose names a tool fixes, and a configured list replaces the rule's defaults, so repeat any default you still need; `content` lists snake_case content folders and files; `tests/follow` and `tests/colocated` take `suites` for test folders with their own layout, such as a Playwright suite.
- **Tests:** `tests/follow` and `tests/colocated` keep a test beside the code it covers, named `<file>[.<environment>].test.ts` or `<behaviour>[.<environment>].spec.ts`, and the story rules above keep setup in the kit.
- **Manifests:** `manifests/sorted` keeps every `package.json` in sort-package-json order, and `manifests/source-first` puts the `source` condition first in `exports` and `imports`.
- **Biome:** the `biome` rule reports Biome's error findings as `biome/<category>`. The preset's plugins ban ambient time, randomness, `console` and `process.env` in favour of Effect's services.

### API

Import names from their defining module; there is no root entry. The package's `./*.ts` export pattern also exposes the gate's implementation modules; the following table lists the config, tool and extension entry points:

| Module | Exports |
| --- | --- |
| `config.ts` | `defineConfig`, `QualityConfig`, `Level` (`"error"`), `RuleSetting`, `RuleSettings`, `BuiltInRules` |
| `rule.ts` | `defineRule`, `Rule`, `Configured`, `Finding`, `Findings`, `SourceFile`, `RuleInputs`, `RuleContext` |
| `standardSchema.ts` | `StandardSchemaV1`, `StandardResult`, `StandardIssue`, `describeIssue` |
| `imports/fences/dsl.ts` | `fence` |
| `imports/fences/selectors.ts` | `packages`, `folders`, `files`, `modules`, `scopes`, `anyOf`, `workspace`, `anything`, `external` |
| `imports/fences/model.ts` | `Fence`, `Target`, `Selector`, `Prohibition`, `Examples`, `Chain`, `ExampleStep`, `External` |
| `testProjects.ts` | `testProjects` |
| `naming/testName.ts` | `testName`, `isTestCode`, `isTestSupport`, `ENVIRONMENTS`, `Environment`, `TestName` |

#### Config

| Key | Default | Meaning |
| --- | --- | --- |
| `sources` | `["."]` | Directories or files the source rules check, relative to the repository root. |
| `extensions` | `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs` | Source extensions. |
| `baseline` | `quality/baseline.jsonl` | Counts of existing findings. |
| `exceptions` | `[]` | Permanent exceptions as `{ files, rules, reason, subject? }`. |
| `registry` | `quality/registry.json` | Legacy input for upgrades; run `quality exceptions migrate`. |
| `local` | `[]` | Exposed extension API for rules made with `defineRule`; not required for adoption. |
| `rules` | Every rule at `error` | Options by rule id, such as import boundaries. An explicit `error` or `{ level: "error", options }` is also accepted. |

#### Local rules

The exposed local-rule API supplements the gate; a repository does not need to use it to get the shared policy. Reusable quality policy belongs in Quality itself.

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

Register it with `defineConfig({ local: [noLog] })`. Its check receives `root`, checked paths in `files`, source files in `sources`, `readText(path)` and decoded `options`, and may return findings directly or asynchronously. For options, provide a [Standard Schema](https://standardschema.dev) validator; an absent options object is validated as `{}`, so defaults belong in the schema, and a rule without a schema refuses options. A finding's optional `subject` distinguishes exceptions within a rule and file. A limit rule reports its amount over the limit as `count` and the limit as `threshold`; the baseline stores the count. Set `registrable: false` when a rule must never be excused by a config exception.

#### Command line

```text
quality lint [--config <file>]
quality fix [--config <file>]
quality exceptions migrate [--config <file>] [--from <registry>]
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
| `1` | Failed: uncovered errors, stale exceptions or baseline entries for unknown or disabled rules. |
| `2` | Could not run: invalid input or config, missing files or git history, a failed rule, fixes that do not settle, or invalid usage. |

### Install, shared tooling and limits

```sh
pnpm add --save-dev @shivaedev/quality @effect/platform-node@4.0.4 @effect/platform-node-shared@4.0.4 effect@4.0.4
```

Node 24 or later is required. The CLI loads the TypeScript config through Node's native import; use erasable syntax and `.ts` extensions for relative TypeScript imports.

The package includes `@shivaedev/quality/biome`, `@shivaedev/quality/tsconfig/base.json` for type-checking with `noEmit`, and `@shivaedev/quality/tsconfig/package.json` for package builds, which adds declarations, maps and `rewriteRelativeImportExtensions` so relative `.ts` imports are emitted as `.js`. Read the preset files for their settings. The preset's plugins load from `./node_modules/@shivaedev/quality/biome/plugins`, so install the package at the repository root. Biome sorts a specifier that starts with `#`, `@/`, `~`, `$` or `%` as an alias; a tsconfig path such as `@app/*` sorts with the packages and Biome's `noUndeclaredDependencies` takes it for one, so name aliases in a form Biome recognizes.

The TypeScript base leaves `types`, `jsx`, `paths`, `include` and output directories to each project. A project that needs more built-ins, such as the DOM, sets `lib` itself and keeps `ESNext` in it. A package that type-checks its tests with one config and builds `src` with another extends both, the package preset last:

```json
{
	"extends": ["./tsconfig.json", "@shivaedev/quality/tsconfig/package.json"],
	"compilerOptions": { "outDir": "dist", "rootDir": "src" },
	"include": ["src"]
}
```

For Vitest, install `vitest` and `happy-dom` when the repository has DOM tests, then use:

```ts
import { testProjects } from "@shivaedev/quality/testProjects.ts";
import { defineConfig } from "vitest/config";

export default defineConfig({ test: testProjects() });
```

`testProjects` runs unit tests and specs in Node and `.dom` tests and specs in happy-dom by default. Each test gets 30 seconds instead of Vitest's 5, because tests that start servers, browsers or CLIs take seconds on a busy CI runner. `.slow` tests run only when `--project slow` asks for them. Type tests are excluded from Vitest and belong in the compiler's input. The helper takes no options and rejects suite exclusions.

Outside CI, `testProjects` sets `silent: "passed-only"` so local runs show logs only from failing tests. When `CI` is set to a nonempty value, it sets `silent: false` so CI keeps all test logs. It leaves `reporters` unset so Vitest can auto-detect its agent reporter. If a repository adds a reporter, spread `configDefaults.reporters` instead of replacing the defaults:

```ts
import { testProjects } from "@shivaedev/quality/testProjects.ts";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: { ...testProjects(), reporters: [...configDefaults.reporters, "junit"] },
});
```

#### PostgreSQL URL gate

A skipped test proves nothing. `noSkippedTests` reports unconditional skips as errors, and its automatic fix is disabled: repair the test or remove a claim it cannot prove. Slow tests belong in the slow project.

The **PostgreSQL URL gate** is the only permitted skip convention: a test that needs real PostgreSQL registers conditionally on its `PLATFORM_EFFECT_*_TEST_DATABASE_URL`. Skip only when that URL is absent; with a URL, execute the body against PostgreSQL and let connection or setup failures fail the test. Nothing else may skip. Keep the condition next to the database setup, either in the test file or its shared `test-support` module:

```ts
import { test } from "vitest";
import { databaseUrl } from "#test/postgres.ts";

const integration = test.skipIf(databaseUrl === undefined);
```

`databaseUrl` is the test database URL read by the repository's environment helper. Declare the real PostgreSQL tests with `integration(name, body)`. A conditionally registered suite or Effect tester follows the same URL gate. CI must supply the URL for every such test; a green run with missing URLs gives no PostgreSQL evidence.

#### Configuration limits

All built-in and local rules run at `error`. Config settings cannot disable a rule or downgrade it to a warning. Record existing debt in the baseline instead. Source and test line limits can only be lowered from 150 and 300, and the comment limit from 2; custom test-file patterns and inventory exclusions are rejected.

Declare exceptions in the config once, with a reason:

```ts
export default defineConfig({
	exceptions: [
		{
			files: ["src/parse.ts"],
			reason: "This parser documents and returns the external format unchanged.",
			rules: ["comments/no-jsdoc", "biome/lint/suspicious/noExplicitAny"],
		},
	],
});
```

Quality merges the Biome settings at lint and fix time; do not add or mirror an override in `biome.json`. Files are explicit repository paths. Biome exceptions cover individual lint rules or assist actions; whole checks, rule groups and globs are rejected. `biome/files/includes` is the directory exclusion form: keep `**` and list negative patterns naming directories, such as `!**/test-support/generated`. Quality's shipped exceptions remain part of its internal policy. [Exceptions and upgrades](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/debt-and-hooks.md#exceptions) describes subjects, stale entries and the upgrade command.

- The source inventory and Biome have their own scopes. `quality fix` runs Biome from the config's folder; it is not restricted to the source-rule inventory.
- The installed hook checks files on disk, not only what is staged, and uses each committing worktree's config and dependencies. A pre-existing `core.hooksPath` decides which hook git runs.
- Workspace imports require a declaration in the importing package’s `dependencies`, `peerDependencies` or `optionalDependencies`. Tests, `test-support`, package-root tooling folders (`script`, `scripts`, `tooling`) and package-root config files may also use `devDependencies`. Explicitly export-blocked bundle inputs may use them when no runtime module reaches those inputs in the scanned import graph; an executable or another public export keeps its imports in the runtime boundary.
