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
- The **baseline** records existing debt by rule and file, as a maximum count. It makes strict checks usable before every file is cleaned up. `tighten` and `prune` lower the counts as debt disappears; explicitly writing a named rule for a changed file can raise its count, and that diff needs review.
- The config's **exceptions** list records permanent exceptions once, each with files, rules, a reason and optionally a Quality finding's `subject`. One declaration covers both Quality and Biome rules. A rule may refuse exceptions. An entry that no longer applies fails the gate instead of silently excusing future code.

Exceptions apply first, then the baseline. With the default rule settings, remaining findings fail in one report grouped by rule. A baseline entry with fewer findings left is a note, so removing debt passes immediately. An entry for an unknown or disabled rule fails; debt records must still name a check that runs.

A rule is **fast** unless its definition declares `depth: "deep"`, which marks a check too costly for every local run. The tier belongs to the rule; the config has no switch for it. `quality lint` runs only the fast rules, and every rule when the environment sets `CI` (GitHub Actions sets it), when `CLAUDE_CODE_REMOTE` is `true` in a Claude Code cloud session, or when you pass `--full`; `--fast` forces the fast set even in CI. A fast run ends with a line naming each deep rule it skipped and how to run them, and sets their baseline entries and exceptions aside: they are neither stale nor loose, and the fast run never judges them. A rule can also split its work: its definition's `deepHalf` names a second check that runs only where deep rules run, and reports under the same rule id. A fast run names each deep half it skipped in the same line. The baseline entry of such a rule records in `deep` how many of its `count` findings the deep half reports, and a fast run judges the rest exactly: fewer findings make the entry loose, which the commit check refuses until `quality baseline tighten --staged` lowers it, and more fail the lint. An entry without `deep`, as an earlier Quality wrote it, is only an upper bound on a fast run, and a full run notes once to run `quality baseline prune`, which records the split for every entry whose file has no more findings than its count and raises none; `tighten` records it only for changed files. `tighten` and `prune` also name each file whose deep half now reports more than its entry allows, which CI then reports. Fixed deep-half debt is locked in only when someone tightens, and added deep-half debt fails only where deep rules run, as for deep rules. A full run ends with a line naming the deep rules and halves it ran. `baseline write`, `tighten`, `prune` and `fix` always run every rule and refuse `--fast`. The built-in deep rule is `effect/service-parameters`; `effect/boundary` and `suppressions/no-double-cast` run their syntax checks on every lint and their typed checks as deep halves, and `biome` runs the rules that need Biome's project scanner, those of its `project` and `types` domains such as `noFloatingPromises` and `noUndeclaredDependencies`, as its scanner half. A fast run's Biome turns those rules off, so it skips the scanner and its memory, and sets aside the exceptions that name them.

The work has three parts: connect the repository to the shared tools once; describe an import boundary when its architecture needs one; run the gate and repair findings every day. Writing local rules is not an adoption requirement.

### Rule lifecycle

`defineRule` accepts checks that return findings or an Effect of findings. Its callbacks use the schema's decoded option type, while `configure` and config settings use its input type. Use `RegisteredRule` for a list of rules with different option types; each rule keeps its strict callback types. The adapter validates unknown registry input and runs each check in the run's scope, where a check composes filesystem and child-process work and stops when the run is interrupted. An optional `validate(context)` callback returns inventory-dependent configuration issues before `check`; those issues stop the run as invalid configuration. Configured checks return Effects and preserve their service requirements; tool checks read `FileSystem` and `ChildProcessSpawner` from the environment.

Interrupting a run stops pending manifest reads and its Biome and knip processes and removes their scoped temporary configs before it ends. Expected filesystem failures in rules become findings that name the affected file. A rule crash is a defect; the CLI prints the rule id and original stack. Expected setup failures retain their underlying cause without including it in enumerable error data.

### Testing a custom rule

Create a kit with `makeRuleStory` from the published testing module, and declare it at module level in your local test-support facade. Use it with `@shivaedev/test-story` and Vitest. `repositoryHas` seeds files in a scoped temporary repository, and `check` runs a rule against Quality's real inventory. The optional third argument selects a directory within the fixture; the default is the fixture root. `findings`, `locations` and `messages` read the last check's results. Specs state the expectations.

```ts
import { expect } from "vitest";
import { defineRule } from "@shivaedev/quality/rule.ts";
import { makeRuleStory } from "@shivaedev/quality/testing/ruleStory.ts";

const ruleStory = makeRuleStory();
const { repositoryHas } = ruleStory;

const noDraft = defineRule({
	id: "local/no-draft",
	description: "Replace draft text before merging.",
	check: ({ sources }) =>
		sources.flatMap((source) => (source.text.includes('"draft"') ? [{ file: source.path, message: "Replace draft before merging." }] : [])),
});

ruleStory.it(
	"draft text asks the author for a replacement",
	[repositoryHas({ path: "src/title.ts", content: 'export const title = "draft";\n' })],
	function* ({ check, messages }) {
		yield* check(noDraft);

		expect(yield* messages()).toEqual(["Replace draft before merging."]);
	},
);
```

Seed a `quality.config.ts` that registers the custom rule to test the whole gate. `gate()` runs `quality lint --full`, deep rules included; `gateOutcome()` reads `passed`, `rejected` or `invalid`, `gateReport()` reads its output, and `gateReports(prefix)` reads the finding sections whose rule starts with that prefix. `writes(...)` changes fixture files and `removes(path)` deletes them. Use the kit’s `qualityInstalled()` trait when a fixture imports Quality or its tooling presets. It links the installed package into that fixture. The kit removes its temporary repository when the scope closes. Config imports are cached within the process, so use `quality` from `@shivaedev/quality/testing/adapters/cli.ts` to spawn a fresh command after changing a config.

For an existing kit, compose the lower-level helpers through its local test-support facade: `seedTree` and `removeSeededTrees` from `@shivaedev/quality/testing/adapters/tree.ts` manage fixture files; `scanned` and `findingsIn` from `@shivaedev/quality/testing/adapters/imports.ts` collect inventory and run a configured rule; `runQuality` from `@shivaedev/quality/testing/adapters/cli.ts` runs commands in process. Yield `runQuality(root, "lint")` as an Effect in the kit so it uses the story's controlled clock. These helpers use the same engine as the rule story kit.

### Import compiler service

Import `ImportCompiler` from `@shivaedev/quality/adapters/import-compiler/service.ts`. Its Layer supplies the compiler operations through one `ImportCompiler.layer`; callers yield the service and call `graph`, `departures` or `browserChecker`. Each operation lives beside the service declaration and traces as `ImportCompiler.graph`, `ImportCompiler.departures` or `ImportCompiler.browserChecker`. The service owns no initializer state and requires no additional services.

### Dependency pins and repository hygiene

`manifests/no-test-kits` rejects runtime packages that expose a `testing` module or declare `@shivaedev/test`, `@shivaedev/test-story`, `@shivaedev/test-sql`, `@shivaedev/test-kits` or `vitest` in dependencies, optional dependencies or peers. It checks explicit export names and targets, including conditions and fallback arrays, and inventoried testing modules exposed through wildcards. Blocked exports and development dependencies pass. Private applications and the test-tooling packages quality, vitest-rerun, test, test-story, test-sql and test-kits are exempt. Move reusable runtime-package helpers into test-kits and keep test dependencies in development dependencies.

`manifests/dependency-pins` checks dependencies, development dependencies, optional dependencies and peers in every inventoried package manifest. External dependencies use exact versions, including npm aliases. Workspace dependencies use `workspace:`. Replace `file:` and `link:` dependencies with npm versions or workspace/catalog references in both published and private packages. Quality finds the nearest `pnpm-workspace.yaml` at or above its config folder. When that workspace declares a default or named catalog, external dependencies use `catalog:` or `catalog:<name>`, and the referenced catalog must contain that dependency. Catalog entries themselves use exact versions. Write catalogs as indented block mappings; inline mappings and YAML aliases receive findings instead of escaping the check.

`files/ascii` is opt-in by file selection. It checks the bytes of selected text files, including a UTF-8 BOM, and reports each line containing non-ASCII bytes. Set `forbidden` to check only named Unicode code points or inclusive ranges instead. An entry can replace its character during `quality fix --rule files/ascii`, or give a message for a manual rewrite. Other files are left alone:

```ts
export default defineConfig({
	rules: {
		// Replace curly quotes and ask for a manual rewrite of em dashes.
		"files/ascii": {
			options: {
				files: ["src/game/**/*.ts"],
				forbidden: [
					{ codePoint: 0x201c, replacement: '"' },
					{ codePoint: 0x201d, replacement: '"' },
					{ codePoint: 0x2014, message: "Reword this sentence without an em dash." },
				],
			},
		},
	},
});
```

An entry may use `range: [0x200B, 0x200B]` in place of `codePoint`. When `forbidden` is absent, the rule retains its strict non-ASCII byte check.

`docs/repository-paths` checks paths in backticks in Markdown prose. Explicit `./` and `../` paths resolve from the document; `./` may also name a path from the repository root, as in a command run there. Other paths with a file extension or trailing slash are checked when their first folder belongs to the repository inventory; they may resolve from the repository root or the document’s folder. Prefix an extensionless repository file with `./` or `../` to distinguish it from a rule id or other identifier. Line suffixes and heading fragments are removed before checking existence. Commands, URLs, package specifiers, installed `node_modules` paths, globs, placeholders, fenced examples and released changelogs are left alone. Use a placeholder such as `<app>/src/main.ts` when describing a consumer's example rather than a path in this repository.

`docs/agent-links` requires each inventoried `AGENTS.md` to have a `CLAUDE.md` symlink beside it and each inventoried `CLAUDE.md`, including dangling links, to point to an existing sibling `AGENTS.md`. Create a missing link with `ln -s AGENTS.md CLAUDE.md` from that folder, and keep the instructions in `AGENTS.md`.

`effect/service-folders` checks every folder with a `defineService` declaration and folders directly beneath a `services/` grouping. Each has a `service.ts` with exactly one named exported const initialized by a direct `defineService` call. Type exports may stay; other runtime exports belong in focused files. The existing `effect/service-definition-assembly` check enforces the operation inventory.

### Folders that are not Effect code

Declare deliberately non-Effect subsystems, such as a game engine or simulation, once in `quality.config.ts`:

```ts
import { defineConfig } from "@shivaedev/quality/config.ts";

export default defineConfig({
	nonEffectFolders: ["src/game/engine", "src/game/simulation"],
});
```

`nonEffectFolders` names explicit folders relative to the config directory, without glob patterns or parent traversal. A declaration covers every descendant and does not cover similarly named siblings. A leading `./` or trailing slash is accepted. Inside these folders, every `effect/*` rule and the Effect-specific Biome plugins (ambient runtime, Effect functions and test bodies, Schema naming and keys, and service Layers) are off. Every other rule remains on, including formatting, comments, naming, imports and suppression checks.

The declaration describes code, not imports: an Effect module importing a non-Effect subsystem stays checked, including service types imported from that subsystem. The full inventory and import graph remain available to every rule. Declare the folders in config instead of recording their Effect findings as permanent debt.

### Effect boundaries and services

`effect/boundary` checks every TypeScript or JavaScript source in Quality's inventory, including shipped code, tooling and specs. It reports async functions, methods and arrows, await (including `for await`), `new Promise(...)`, `.then(...)`, try statements and throw statements. Model the work with Effect, fail with a tagged error, and use `Effect.die` for defects. Effect's resource and finalizer primitives model cleanup.

It also reports synchronous calls imported from `node:fs` and `node:child_process` (including aliases, namespace imports and string member keys), parameters typed as Promise or callbacks returning Promise, and each call to a helper whose body throws, unless the helper is defined in an `adapters/` folder. Calls to adapters that bridge throwing third-party control flow, such as a router’s `redirect` or `notFound`, need no call-site exception. A guard called 31 times contributes 31 call findings, in addition to its throw statement. `Effect.sync` reports a throwing body: explicit throws, throwing helpers, synchronous Node IO, `JSON.parse`, URI encoding/decoding, `BigInt` and synchronous Schema decoders/encoders. Use `FileSystem` and `ChildProcessSpawner` for IO, and `Effect.try` with a tagged error for fallible synchronous work.

It also reports an `Effect.promise` or `Effect.tryPromise` call whose callback calls a binding imported from an outside library, meaning any import other than `effect`, `@effect/*`, `@shivaedev/*`, a workspace package, a relative path, a `#` alias or a Node builtin. Move that bridge into a module under `adapters/` that returns an Effect. The check reads the file's imports, not library types: bridges to workspace code and dynamic `import()` are accepted, and a Promise reached through a library value the code received, such as a client's method, is not seen.

`Effect.run*` references in core are reported even without Clock, Config or Random. Yield the computation so it uses the caller's runtime. Runners are accepted in `cli.ts`, `main.ts(x)`, `entry.ts(x)`, `*-cli.ts`, tool configs and tests, modules that call `runMain`, and modules with the `fileURLToPath(import.meta.url) === process.argv[1]` entry guard. Browser bootstraps use the `main` or `entry` filename convention; the starter uses `examples/starter/src/client/main.tsx`. These entry-point conventions accept runners only; the other boundary checks still apply.

Within Effect code, folders named `adapters/` or `test-support/`, at any depth, are exempt from this boundary rule, and so is a tool config directly in a package's folder (`*.config.ts` beside its `package.json`, such as `vitest.config.ts`), because the tool loads it from that fixed path. A config deeper in the package, such as `src/domEnvironment.config.ts`, is checked. An `adapters/` folder is the one place where code may use what Quality forbids elsewhere, because a library requires it; keep it small and hand the rest of the application Effect values. The name is fixed by convention, with no config or copied Biome plugin globs. Adapter code still follows `effect/service-parameters` and the ambient time, randomness, console and environment bans.

The `ambient-runtime` Biome plugin also reports `Effect.run*` calls whose computation contains `Clock`, `Config` or `Random`, `currentTimeMillisUnsafe`, crypto UUIDs and bytes, `performance.now`, process arguments, working directory and exit state, `globalThis.process.env`, timeouts and microtasks. Yield service computations in the caller's Effect so its environment controls them. These additional checks apply to core TypeScript code. They accept `cli.ts`, `main.ts(x)`, `entry.ts(x)`, `*-cli.ts`, modules that call `runMain`, use `NodeRuntime.runMain` or guard execution with `fileURLToPath(import.meta.url) === process.argv[1]`, tool configs, tests, `adapters/` and `test-support/`. The existing `Date.now()`, `new Date()`, `Math.random()`, console and direct `process.env` bans still apply there.

`effect/service-parameters` reports parameters carrying a service in exported and local functions and public methods, including returned factories and function-typed parameters returning services. It follows service classes and tags, non-empty Contexts and service implementation shapes through aliases, interfaces, generic constraints, inferred parameters and destructuring. Read services from Effect's environment instead. An Effect or Stream requiring a service is a computation and is accepted. Methods implementing a service and functions constructing Layers may take services as parameters. Within Effect code, `test-support/` folders are exempt from this rule; `adapters/` folders are checked. Module-level PascalCase functions returning React nodes or elements are components: their props and callback prop signatures may carry services. A plain function, one that is neither an `Effect.fn` or `Effect.gen` body nor nested in one, may take an `AtomRegistry` or `AtomRpcClient` because it has no Effect environment to yield the handle from, even when it builds Effects for later; an `Effect.fn` taking the same handle still fails, and so does a parameter that carries another service beside it. A tag that a function never yields, calls or provides and only hands to a `.middleware(tag)` declaration or `Context.pick`, directly or through a local helper that does the same, is a declaration and is accepted. Callbacks whose arguments are supplied by their owner keep those arguments, including object methods contextually typed by a foreign signature, inline host plugin methods and methods implementing a foreign interface; wrapping and returning a callback as a runtime operation still checks it. Test-kit registrations do not turn plain kit state into runtime service plumbing. Type predicates inspect service values without declaring a runtime dependency. Operation parameters supplied exclusively by the service's `methods: (state)` argument, directly or through other such parameters and internal helpers, carry owned initializer state, including members of the Layer’s own Scope and parameters in helpers wrapped with `Effect.fn`. A hand-built state object or an independent Scope parameter still counts as service plumbing. Owned fibers, closeable scopes and native atom evaluation contexts follow Effect's lifecycle conventions; wrapping a function with `Effect.fn` still checks its parameters. A function may pass a foreign resource to another when the calls supply values constructed through an outside library or received by its host callbacks, including local construction helpers and an Effect acquisition wrapper; reading that resource from the environment still counts as service plumbing. Installed implementation shapes are discovered in the consuming repository's package scopes, alongside the framework service package's scope.

A local lint runs the part of `effect/boundary` that reads each module alone: the constructs above, synchronous Node IO, runners, Promise bridges, and calls to throwing helpers defined in the same module. Calls to throwing helpers imported from other modules, `Effect.sync` bodies that reach one, and Promise-typed parameters need the type checker and run in its deep half, in CI and with `quality lint --full`.

Both rules refuse config exceptions and inline suppressions. Record existing debt with `quality baseline write --rule effect/boundary` and `quality baseline write --rule effect/service-parameters`; the normal report and baseline burn-down apply.

When an upgrade expands these checks, inspect the new findings, fix every finding you can and record retained debt with `quality baseline write --rule effect/boundary` (or `--rule effect/service-parameters`). Writing the baseline accepts every rule, including rules that permit config exceptions, and records unchanged files. Omit `--rule` to record every current finding. The output names recorded rules and counts; for rules new since the previous baseline, review each case and report any misread to Platform with the file, lines and what Quality would need instead of leaving it as debt. Run `quality baseline tighten` after repairs to lower the touched files' counts.

### Package service ids

`effect/service-ids` checks literal ids passed to `Context.Service`, `Context.Reference`, `defineService` and RPC middleware `Service` or `Tag` constructors in workspace packages under `packages/`. Each id must start with the owning package manifest's `name`, including a trailing slash. The workspace declarations identify package folders, and the deepest matching folder owns a source file. For example, `packages/<group>/<domain>/package.json` named `@antumbra/domain` uses `@antumbra/domain/Store`. Prefix a reported id with its owning package and update any references to that id.

Import and local aliases, string literals and templates without substitutions are checked, including in adapters and tests. Computed ids, files without a named workspace owner and files outside `packages/` are left alone. This rule refuses config exceptions and inline suppressions.

### Service assemblies

`effect/service-definition-assembly` keeps top-level `defineService` declarations as operation inventories. List `id`, `requires`, `initialize` and `methods` directly. Import a named initializer Effect or use `Effect.void`; the methods arrow returns a literal record of imported named operations. A state factory may capture only owned lifetime state. `genericMethod` can wrap either form. Keep implementation bodies in focused files outside the assembly. `effect/service-model` follows each inventory entry, including state factory returns and piped bodies, to require `Effect.fn("Service.operation")`, with the service name taken from the last segment of its id. Keep each exported operation in its own sibling file, following the repository's filename conventions, including folder prefixes. It follows initializer values and returned closures to distinguish owned resources from dependencies: repositories, SQL clients, HTTP clients and configuration belong in `requires` and are yielded inside operations. Initializers hold their Layer’s own Scope from the environment, scopes they create, acquired handles, caches, refs and locks, closures over those resources, and context data captured at setup, such as a caller id or the data-only value of a native `SessionUser`, `Subject` or `Identity` tag. Caller tags are identified by their original declaration names, so import aliases preserve that role; a callable capability inside a caller value remains a dependency. The Layer registration chooses their lifetime.

`effect/service-folders` applies wherever a file declares `defineService`, as well as to conventional `services/<name>` folders. Each service has its own folder. Its declaration belongs in `service.ts` with one named service export, beside its operation files. A second declaration beside an existing `service.ts` belongs in a separate service folder.

`effect/context-capture` rejects `Effect.provideContext`, `runPromiseWith` and `runForkWith` calls in core code, including imported aliases and destructured runners. It also checks the native Context overload of `Effect.provide`; Layer provision stays available. Composition roots and full-application test harnesses may merge inherited services with contexts built from Layers and acquire those Layers under an explicit restart scope with Scope.provide, or capture an environment inside an application whose requirements are fully provided by Layers. This follows the construction rather than the filename or folder; an ambient context in an ordinary service remains a finding. Only files with a call that could re-provide a context enter its type-checked program: `provideContext`, `runPromiseWith` or `runForkWith`, by name or through an import alias, a destructured name or a local alias, or a `provide` whose last argument is neither a `Layer.…` expression nor a name ending in `Layer` or `Live` or named `layer`. A runner re-exported under another name through a local module is not seen. Yield the environment instead of capturing and re-providing it; runtime bridges belong in `adapters/` or `test-support/`. These service rules permit no config exceptions or inline suppressions. To adopt the policy in an existing repository, review retained findings and record them with `quality baseline write --rule effect/service-model --rule effect/service-folders --rule effect/context-capture`.

The rule reports hidden configurations and method records, configuration and operation spreads, computed members, local implementations and inline bodies, including in adapters and tests. It takes no config exceptions or inline suppressions. See the [service guide](https://github.com/ShivaeDev/platform/tree/main/packages/service#1-assemble-the-service-from-focused-files) for the shape.

### Node builtin imports

`effect/adapter-imports` reports value imports of Node builtins outside `adapters/` and `test-support/`, at the import site. It includes side-effect imports, value re-exports, literal dynamic imports and `require` calls, with or without the `node:` prefix. Type-only imports and re-exports are accepted, including inline `type` specifiers when every binding is a type. `node:path`, `node:path/posix` and `node:path/win32` are accepted everywhere, shipped code included: their functions only compute strings. Tool configs directly in a package's folder (such as `vitest.config.ts`, which the tool loads from that fixed path) are accepted. Entry modules (`cli.ts`, `main.ts(x)`, `entry.ts(x)`, `*-cli.ts`, modules that call `runMain` and modules with the `fileURLToPath(import.meta.url) === process.argv[1]` guard) may import `node:process` to read arguments and the working directory; their other builtins, and `node:process` in any other module, test or config, are still reported.

Use Effect's `FileSystem`, `ChildProcessSpawner`, `Config` and other platform services instead. When a library requires a builtin, bridge it in an `adapters/` module that exposes Effect values. Using or exposing a library's types and calling a library function that returns a plain value need no adapter, in core and client code alike. A library call that returns a Promise, can throw or reaches the host goes through a module in `adapters/` that returns an Effect. `effect/boundary` reports the Promise bridges it can see from imports; no rule sees a library function that throws, so review carries that case. Recharts is the stack's charting library; build charts with shadcn's Chart component (`ChartContainer` and friends) rather than raw recharts primitives where shadcn covers the case.

The rule refuses config exceptions and inline suppressions. For existing debt, run `quality baseline write --rule effect/adapter-imports`; baseline shards keep one entry per file with its finding count. Run `quality baseline tighten` after replacing builtins.

### Shared error classes

`effect/shared-error-classes` reports a tagged error class that reuses a tag exported by `@shivaedev/errors`. Import the shared class from the module named in the finding instead. The rule reads syntax and builds no TypeScript program. It parses the errors package's exported modules, preferring the published source beside a declaration file, and compares literal tags rather than class names. A tagged error is a class built by a `TaggedError` or `TaggedErrorClass` constructor with a literal tag, such as `Data.TaggedError("NotFound")` or `Schema.TaggedError<NotFound>()("NotFound", …)`, a class with a `readonly _tag` string literal that extends another, or a subclass of a shared class imported from the errors package or of a tagged class in the same file. A tag passed as a constant or through an aliased constructor is not seen. It uses the repository's installed errors package, or Quality's dependency when the repository does not yet depend on errors. It checks adapters and tests too. Shared declarations and imports, distinct tags and non-error classes are accepted.

### RPC handler boundaries

`effect/rpc-boundary` reports calls to `rpcBoundary` or `rpcBoundaryHandlers`, imported by name or as a namespace from `@shivaedev/errors/boundary.ts` or `@shivaedev/errors/rpcBoundaryHandlers.ts`, outside modules that build native RPC handlers with a group's `toLayer`, `toLayerHandler`, `toHandlers` or `of`. Move the boundary to the handler module so services preserve their typed failures. The rule reads syntax and builds no TypeScript program. A builder call counts unless its receiver is visibly not a group: an `effect` import other than RPC, or a local value built from neither an import nor a group. A service tag's `of` shares the name, so `of` counts only on a group built in the module or on a member chain such as `Notes.application.of`. A boundary re-exported through a local module or assigned to a local alias is not seen; unrelated functions and methods with the same names are accepted. Test-support kits are accepted. The rule refuses config exceptions and inline suppressions.

### Failure honesty

`effect/failure-honesty` checks TypeScript and JavaScript throughout the inventory, including adapters and tests. It reports four failure-hiding shapes:
- A forever loop piped through `orDie` and then forked. Recover a named reason within each iteration with a Schedule that paces retries, or expose an explicit unavailable state and supervise termination.
- `Effect.retry({ while })` without `times` or `schedule`. Supply a Schedule that paces retries. Use `Schedule.spaced(...)` without a count for a reconnect loop that must not stop; preserve the typed failure when retries end.
- A blanket `catch`, `catchAll`, `catchCause` or `catchAllCause` whose handler returns `Effect.succeed(...)` or `Effect.void` on every return branch. Catch a named reason with `catchTag` or `catchIf`, re-failing other errors, or model an explicit unavailable state with `Effect.match`. Inside `test-support/`, a blanket `catch` whose inline handler derives every success value from the caught error is a readout translating the failure into a domain word and is accepted; the same catch elsewhere, a handler that ignores its error and `catchCause` are still reported.
- A FileSystem service call wrapped in `Effect.option` or `Effect.orElseSucceed`. Catch a named reason such as `NotFound`, propagate other failures, or represent unavailability explicitly. An option around a non-filesystem computation remains accepted.

The check follows Effect import aliases, local operation and handler aliases, nested calls and `.pipe(...)` stages. It recognizes FileSystem instances yielded from the native service and their local aliases. Retry options are checked as object literals; a spread may supply a bound. It does not infer whether a supplied schedule terminates or analyze arbitrary recovery helpers. Static findings identify these shapes, not every possible swallowed failure.

This rule refuses config exceptions and inline suppressions, with no exempt folders. Review each finding, fix what you can and record retained debt with `quality baseline write --rule effect/failure-honesty`. Run `quality baseline tighten` after repairs.

### 1. Once per repository: connect the shared policy

A new repository needs no `quality.config.ts`. Quality checks sources from the current directory with every built-in rule at its default error level. Baseline entries for `packages/<package>/...` live in `packages/<package>/quality-baseline.jsonl`; entries outside packages live in the root `quality-baseline.jsonl`. A package with no entries has no shard file. Permanent exceptions belong in `quality.config.ts`.

Create a root `biome.json`:

```json
{
	"extends": ["@shivaedev/quality/biome/preset.json"]
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

For pnpm applications, `quality ci` checks peer dependencies, then runs the app’s `lint`, `typecheck`, `build` and `test` scripts in that order. It stops at the first failure. Keep those scripts as the app’s native tool commands; set `ci` to `quality ci` and let `ready` call the same script.

Run `quality ci --coverage` to collect V8 coverage during that single test run. It writes `coverage/lcov.info` and `coverage/junit.xml`, including when tests fail, through Vitest's `reportOnFailure`. Add `coverage/` to `.gitignore`. Quality provides the V8 provider; the application needs no coverage dependency or separate coverage configuration. Without the flag, the gate uses the test script unchanged.

The optional pre-commit hook runs Quality's lint, then the `typecheck` script when it exists, then an optional `quality:commit` script for repository checks. It uses the manifest's `packageManager` (`npm`, `pnpm`, `yarn` or `bun`), defaulting to `npm` when omitted. Add `quality:commit` only when the repository has extra commit checks. A repository whose CI runs the full gate on every change can set `preCommit: "staged"` in its config: the hook then runs only Biome's lint and format checks on the staged content of the staged files, and skips the full lint, which waits for the heavy-process lock, and both scripts. Unstaged changes and untracked files do not block such a commit, and a file edited again after staging is checked as staged. In a Claude Code cloud session, where `CLAUDE_CODE_REMOTE` is `true`, the hook still runs the full checks. The hook's lint chooses its rule set as `quality lint` does: a local commit runs the fast rules, and a cloud session or a `CI` environment runs every rule.

Inspect the report and install the optional commit check explicitly:

```sh
quality lint
quality hooks install
```

For an application setup script, use `quality setup`. It installs the same hook when the current folder has its own `.git` entry, including a linked worktree. An unversioned app or an app inside another repository leaves hooks alone.

Installing the package does not install a hook. `hooks install` writes the repository's pre-commit hook. A hook Quality did not write is kept unless `--force` replaces it. For an existing repository or a policy upgrade, `quality baseline write` records every current finding, including unchanged files. Add `--rule <id>` to record only selected rules. The output asks you to fix what you can first, then review each recorded case of rules new since the previous baseline and report misreads to Platform with the file, lines and what Quality would need instead of leaving them as debt.

Apps generated by create-app provide `pnpm baseline write` for adopting Quality upgrades in existing application code. Review the recorded findings and burn them down with `pnpm baseline tighten`; checks remain strict above the recorded counts. The starter stays free of Quality debt, so newly generated apps start with an empty baseline.

Use `pnpm format --rule react/jsx-conditionals` (or `quality fix --rule react/jsx-conditionals`) for mechanical repairs. It extracts a conditional child into a variable before its return when the enclosing intrinsic elements or fragments have no attributes or other children. It preserves the conditional expression, including falsy values such as `0`, and leaves mapped children, component elements and evaluation-sensitive cases for manual repair. Remaining findings are printed and exit 1 even when the baseline covers them. The rule-specific command does not run Biome’s unsafe fixes.

`quality fix --rule tests/grouped-outcomes` explains why it cannot fix safely: `outcomes` constructs rows eagerly, then lazily invokes each readout callback in row order before the grouped assertion. Consecutive assertions evaluate and assert one readout at a time, stopping at the first failure. Converting them changes evaluation and failure order and needs manual review. Other unsupported rule ids also exit 2 with a manual-repair message.

Add a config only when the repository needs to supply facts such as source locations or import boundaries:

```ts
import { defineConfig } from "@shivaedev/quality/config.ts";

export default defineConfig({ sources: ["src"] });
```

When a config exists, its folder is the root for paths and hook scripts. Without one, the current directory is the root. `sources` chooses the files the source rules read; a missing source stops the run. Directory discovery skips untracked files ignored by git through `.gitignore`, `info/exclude` or `core.excludesFile`, and the `.git`, `.worktrees` and `node_modules` directories. Tracked files remain checked even when an ignore pattern matches them; a folder named `generated/` does not exempt authored code. Generated output that git ignores is never reported, but Quality follows its imports: a module the sources import that git ignores joins the import graph, so `imports/runtime` and transitive fences see what it reaches and report the checked file that imports it, and `code/unused` counts its imports as uses. Some repository rules, such as manifest sorting, inspect the whole repository even when `sources` names only `src`.

Quality reads the skills tool’s `.shivaedev-skills.json` ownership manifest in each repository’s `.agents/skills` folder. It skips the recorded folders, their `.claude/skills` links and the manifest itself in source checks, Biome lint and formatting, manifest sorting and fixes, including rule-specific fixes. Local skills beside those copies remain checked. Change a shared skill at its source and run `shivaedev-skills sync` to refresh the copies.

Registry ownership is explicit. A package declares unmodified registry files in its `package.json` under `quality.toolOwned`, with package-relative gitignore globs and reasons. Source rules, Biome lint, formatting and fixes skip those files; Knip still follows their imports so their dependencies count as used. A registry filename or `components.json` alone grants no ownership: customized `button.tsx` and `dialog.tsx` remain checked unless the facts declare otherwise. Remove a declaration when a file becomes application-owned. A missing match or blank reason stops the gate.

```json
{
	"quality": {
		"toolOwned": [
			{
				"glob": "src/components/ui/button.tsx",
				"reason": "The registry owns this unmodified component."
			}
		]
	}
}
```

Declare browser targets through Browserslist in the application's `package.json` (`"browserslist": ["electron 38.0"]`) or `.browserslistrc`. Quality uses the production environment, resolves Electron to its Chromium renderer and checks CSS features reported by Biome against MDN browser compatibility data for every selected browser. Features must be supported by every selected target. Without a declared target, `useBaseline` keeps the shared availability-year policy. A nested application's target applies to its CSS without changing untargeted sibling applications.

Generator fixture arguments in custom test entries are accepted by Quality's `noDoneCallback` recognition; parameters of actual Vitest entries remain checked. File-input `accept` values may contain whitespace between comma-separated MIME types, such as `image/jpeg, image/png, image/webp`; invalid types remain findings.

Quality reads each app's `tsr.config.json` and literal `tanstackRouter` / `TanStackRouterVite` options imported from `@tanstack/router-plugin/vite` or `@tanstack/router-vite-plugin` in `vite.config.*`. `routesDirectory` is relative to that app's config folder and defaults to `src/routes`; Vite options override the JSON options. Declare the folder once in the router configuration: `files/named-after-export` accepts route filenames, and `files/folder-names` accepts their route groups and pathless layout folders, including routes added later. Other source rules still check routes. Ordinary files outside that folder, other apps and helper files excluded by `routeFileIgnorePrefix` (default `-`), `routeFileIgnorePattern` or `routeFilePrefix` keep their normal naming checks. A folder named `routes` alone establishes no ownership. Ignore patterns use Unicode regular expressions. Quality reads configuration without executing Vite: computed or spread router options must move into `tsr.config.json` or become literal options. Malformed JSON or invalid route-folder settings stop the gate. Exception declarations still name explicit files; route discovery adds no exception globs.

Module folders under `src/modules/<name>` use the same `client/` and `server/` import boundaries as the foundation, and their shared declarations remain independent of both runtimes.

Naming rules treat numbered migration files such as `src/server/migrations/0001_create_notes.ts` as tool-owned, including in nested apps and in module folders such as `src/modules/notes/server/migrations`. The file must sit directly in its migration folder and match `NNNN_snake_case.ts`: four digits, an underscore and a lowercase name starting with a letter. Files elsewhere, files with other names and subfolders remain checked. The Biome preset lets `.ts` files directly in that folder whose names start with four digits and an underscore default-export their migration Effect, because Effect's migration loader imports the default export; Biome globs cannot spell the rest of the pattern, so the naming rules still report a malformed name.

Naming rules recognise Xcode's `*.xcodeproj` and `*.xcworkspace` bundles and their `Contents.json`, project containers and matching app folders, localised `*.lproj` folders, and `*.xcassets` catalogs with their asset sets, metadata and images.

Swift Package Manager packages containing `Package.swift` retain their package folder name and `Sources/<Target>` layout.

Android source sets with a sibling or own `AndroidManifest.xml` retain their native source set names and `res/` resource directories, including qualifiers such as `mipmap-hdpi` and `values-night`, with lower_snake_case resource files.

These contexts work at any repository path without configuration; TypeScript and JavaScript, deeper app source folders and ordinary assets outside native resource contexts remain checked, including within `ios/` and `android/`.

`defineConfig` checks the config's types. The CLI also validates it: a broken config, unknown rule id or invalid options fails before checks run. An explicit `--config` path must exist.

### 2. When architecture needs it: describe an import boundary

`imports/admin-paths` follows production imports within each `src/` tree. Files reached only from admin paths, `adminPage`, `registerAdmin`, an exported `adminRegistration`, or a guard using an imported admin permission belong under an `admin/` segment. Member code reaching an admin file is reported too; each finding names the folder to move it to. A member module may compose its admin `registration`, `pages` and `make` files from a `registration` or `modules` file, and both sides may use member persistence. Whole admin modules can live in `src/modules/admin/<name>/`; member features keep admin declarations, server work and client work in their own `admin/` subfolders. Type-only imports also determine ownership; test consumers are excluded. This checks literal import reachability and direct named framework calls, not runtime authorization or computed loaders.

An app says where its code runs through folder names. A package adopts the runtime convention by having `src/client/` or `src/server/`; no config entry is needed. In that package, `src/client/` is browser code, `src/server/` is server code, and everything else is shared except package-root tooling. Keep shared code wherever its topic belongs; there is no required `src/shared/` folder or runtime file suffix.

`imports/runtime` rejects client imports of server code or Node built-ins. Shared code may import neither client nor server code, use browser globals such as `window`, `document` or `localStorage`, or import Node built-ins. Both client and server code may import shared code. The check includes type imports and re-exports and resolves aliases through the shared import graph. Locally bound names and property names are not browser globals; portable web APIs such as `URL`, `fetch` and `AbortController` remain available to shared code. Test files and `test-support/` ship nowhere and are outside this runtime policy.

A package whose code all runs in one runtime declares it in its manifest instead of nesting everything in one folder: `"quality": { "runtime": "server" }` makes every source file server code, and `"client"` makes every file browser code. Package-root tooling stays server code. A declaration beside `src/client/` or `src/server/` is reported on the manifest, as is any value other than `"client"` or `"server"`; choose one convention per package.

A package with a nonempty `bin` entry and no runtime folders is server code throughout. Runtime folders take precedence when a package also ships browser code. A Node library without a CLI declares `"runtime": "server"` or uses `src/server/`; `engines.node` alone does not say that a package is Node-only. A package with no runtime folders, runtime declaration or `bin` entry has no runtime policy beyond its tooling. Explicit fences run in every package. Runtime folders are detected independently of `sources`, including empty folders; `sources` still selects the code that is checked.

Tooling is server code in every package, including the workspace root: files under its top-level `script/`, `scripts/` and `tooling/` folders, and top-level JavaScript or TypeScript config files such as `vitest.config.ts`. A tooling folder or config file nested under `src/` follows the source runtime policy. Browser and shared code cannot import package-root tooling.

The manifest owns ordinary workspace dependencies. An **application** is a package whose manifest depends on `@shivaedev/platform`, the dependency shell that brings every runtime piece of the ShivaeDev framework. It imports each piece by its own name without listing it: `imports/manifest` and the `biome` rule's undeclared-dependency check count an import as declared when an entry point the application declares lists the piece among its dependencies. `@shivaedev/platform` is the entry point for any code and `@shivaedev/test-story` for test code, tooling and test support only. When a private package's import would be covered by an entry point it lacks, the finding names the entry point to add. `manifests/application` asks an application for `publicHoistPattern: ["@shivaedev/*"]` in the nearest `pnpm-workspace.yaml`, searching upward from the package, because pnpm does not link the pieces where the application can resolve them otherwise. It also rejects a dependency entry beside the entry point that already brings it, such as `@shivaedev/sql` beside `@shivaedev/platform`, and names the entry to remove. A library never depends on platform, so it declares every piece it imports.

Quality classifies a package's own `test/**` tree beside `src/` as test code for `imports/manifest`, `imports/no-test-code` and `structure/max-lines`. Helpers there may use development dependencies and the test line cap, while production imports of those helpers still fail. A private workspace package is test composition when it is reached from tests or development tooling and every external consumer is test code, development tooling or another test-composition package. Development tooling includes script folders and files directly at a package root named in its scripts. Package names and paths do not determine this role. Published packages, packages with a `bin` entry or a module under `src/` or its built equivalent named in a non-test script, and private packages without test consumers remain production code; any production consumer, including a type import, restores production classification through the composition chain. Scripts named `test` or `test:*` remain test entry points.

When a package promises more, put `quality.fences.config.ts` beside its `package.json`, exporting an array of fences as the default. Quality discovers this file at the repository root and in workspace packages, even when `sources` includes only their source folders. The root config does not list boundary files.

A **fence** is a prohibition on imports, with a reason and one illegal and one legal example. Quality validates all discovered fences together, so duplicate names or contradictory examples stop the run. An unreadable file or invalid default export also stops the run. The `imports/fences` rule checks them with Quality's shared import graph, resolver and report.

```ts
import { fence } from "@shivaedev/quality/imports/fence.ts";
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

This is `packages/<ui>/quality.fences.config.ts`; paths remain relative to the repository root. Fences supplied through `rules["imports/fences"].options.fences` join the same policy. This adds a fact about the repository's architecture to the shared import check. It does not select a different set of Quality rules. Every file named in either chain must exist in the checked tree; a deleted file stops the run. Use `external()` for external targets. The chains demonstrate hypothetical imports between those files; they need not be actual imports. The illegal chain must cross this fence alone; the legal chain must cross none. `mayNotImport` checks direct imports; `mayNotReach` also follows repository imports transitively; `mayImportOnly(...subjects).of(unit)` permits only named modules or folders of a unit. A source exception such as `.from(folders("packages/ui/src").except(files("packages/ui/src/testClient.ts")))` admits that one file while its siblings remain fenced. Fences count type imports but never hold test files or files under `test-support/`. The default `imports/no-test-code` rule rejects production imports of either, including type imports and re-exports. Move shared code into a production module that tests can import.

The import rules resolve every literal specifier with the nearest `tsconfig.json`, or the project it references that includes the file. They preserve the compiler's resolution settings, inherited path aliases and package export conditions, including NodeNext's import and require branches. `imports/resolvable` reports config syntax errors, invalid options and unreadable extended or referenced configs as findings on the config file; repair those before relying on import findings. Without a tsconfig, Quality uses bundler resolution with the `@shivaedev/source` condition. The run stops when the sources hold no module at all.

Vite asset queries resolve the path before the query, including package assets through their declared exports. Supported suffixes match `vite/client`: `?url`, `?raw`, `?worker`, `?worker&inline`, `?worker&url`, `?sharedworker`, `?sharedworker&inline`, `?sharedworker&url`, `?inline`, `?no-inline`, `?url&inline`, `?url&no-inline` and `.wasm?init`. For example, `import url from 'zxing-wasm/reader/zxing_reader.wasm?url'` resolves the exported wasm file without an application module declaration. Missing files, private package paths and unsupported query suffixes still produce findings.

A relative or `#` import of a file that a generator writes before the tests run resolves only inside a folder that `imports/resolvable` lists as `generated`; the folder, or every file an import names in it, must be ignored by git. The folder may keep a tracked `README.md`, `.gitkeep` or `.keep`, such as a README that names the command which writes the output, re-included with `!`; any other tracked file makes it source, not generated output. Imports into it resolve whether the output is present or not yet written:

```ts
import { defineConfig } from "@shivaedev/quality/config.ts";

export default defineConfig({
	rules: { "imports/resolvable": { options: { generated: ["src/generated"] } } },
});
```

The repository's `.gitignore` ignores the output and keeps the README:

```gitignore
src/generated/*
!src/generated/README.md
```

### Story tests

`tests/adapter-only-fakes` reports `vi.mock` and `vi.doMock` of repository modules outside `adapters/`, and replacement implementations on spies of owned exports. It resolves module paths with the repository's TypeScript projects, including aliases. Adapter modules, outside libraries, platform globals, observing spies and quoted fixture source pass. For Layers and `Effect.provideService`, it reports locally constructed replacements of imported owned `defineService` services. Its static analysis does not identify bare Context service keys, factory-produced implementations or service instances passed through parameters and object properties. Review those supplies as well: fake repository code only under `adapters/`, and delete a test whose failure can only be shown by faking internals.

Keep story kits and fixtures in `src/test-support` and keep each spec specific to its story. [`@shivaedev/test-story`](https://github.com/ShivaeDev/platform/tree/main/packages/test-story#readme) explains how to build the kit, traits and verbs over a real engine.

Quality's `tests/story-specs` rule reports a test file that declares tests without a kit's `it`, including plain Vitest `it` and `test` declarations mixed with stories. Typecheck tests are exempt, as are only the packages named `@shivaedev/test-story`, `@shivaedev/test` and `@shivaedev/types`, wherever they live in the workspace or at its root. Other dependencies of test-story, including development dependencies, remain checked.

Quality's `tests/story-engine` rule reports spec bodies that read raw service handles, reach through `story.engine`, or call production constructors to wire an engine outside the kit. It follows local aliases, destructuring and re-exported service tags inside the body, including nested callbacks. Move that access into verbs or traits in `test-support/` and keep expectations in the spec. A constructor can remain the subject of its colocated spec; native SQL handles used only for `withTransaction` can wrap kit verbs. Native Effect data constructors remain available. The rule also reports a kit story with no traits whose body never references its verbs, its story or its test context. Drive the engine through one of the kit's verbs or traits, or, if the code under test is pure, move it to `<stem>.unit.test.ts`, which reaches no engine and mocks nothing. The rule follows the same kit origins and prerequisite exemptions as `tests/story-specs`; unit and typecheck files are exempt.

`tests/global-retries` reports a `retry` option on a test, suite or kit story registration, including `retry: 0`. Remove the option: retries are global only and recorded by vitest-rerun so flakes stay visible. The rule follows registrar imports, aliases and modifiers, and options declared as literals, shared variables or spreads. Runner configuration and Effect retry schedules are accepted. It checks registrations throughout the inventory, including unit tests and test-support files, with no story prerequisite exemptions.

There is one other honest form. A pure function with no engine behind it gets a plain test in a **unit test** file, declared by the `unit` modifier: `parse.unit.test.ts` beside `parse.ts`, or `<behaviour>.unit.spec.ts`. A unit test exercises one unit and reaches nothing bigger, so `tests/story-specs` rejects a `.unit` file that reaches an engine, directly or through what it imports, following runtime imports through the shared import graph; type-only imports do not count. The engines are Node's file, network, process and worker modules, database clients, HTTP and socket libraries, DOM libraries and the story runners. A test-support fixture the unit file imports must pass the same check. The rule also rejects mocking (`vi.mock`, `vi.spyOn`, `vi.fn`, env and global stubs, fake timers), providing services (`Effect.provide*`, `Layer`, `ManagedRuntime`, `it.layer`) and DOM use in the unit file and its test-support fixtures.

A unit file also reaches no `Clock`, `TestClock` or `Effect.run*` runner, including aliases, subpath imports and re-exports, through any runtime import chain, including production modules and shared `it.effect` helpers. Each such finding points to the first relevant import or call in the unit file and names the helper chain to the terminal file and line. A requirement-free Effect type does not prove purity. Keep pure logic in plain Vitest `it` tests using synchronous APIs or `Schema.decodeUnknownResult` / `Schema.encodeResult`; exercise behaviour that needs the Effect runtime through the package story kit. Type-only imports, comments, strings and unrelated local objects named `Clock` do not count.

When the module under test reaches an engine, the finding names the import chain and asks you to split the module: move the pure code into a module that reaches no engine and test that one. The static check reads imports and syntax. The runtime guard in `testProjects` catches I/O hidden inside an external package or a global such as `fetch` when a unit test runs.

Every finding names both repairs: drive the engine through the package's story kit, or, when the code under test is pure, move the test to a `.unit` file. Never wrap a pure function in a story that ignores its kit.

Every package tests its real engine through its own story kit, so setup and actions share the package's domain vocabulary. To repair a finding, build the kit with `storyKit` from `@shivaedev/test-story/server/storyKit.ts` in `src/test-support`, import it in the spec and replace plain registrations with `kit.it(name, traits, body)`. The rule follows imports, aliases, conditional registrars and arrays of kits (including tuple loops) back to the kit; it checks declarations, while review and runtime tests establish whether the kit exercises the real engine.

Quality's `tests/story-setup` rule reports top-level test functions named with the words `seed`, `make`, `build` or `setup`, and fixture-writing calls imported from Node's `fs` or `fs/promises`. It leaves source and `test-support/` files alone. This is a check for those syntax patterns; a passing test file still needs review of what it tests.

Specs keep expectations visible. `tests/spec-helpers` keeps setup and action helpers in the kit; pure matchers and readers may stay beside their specs. It recognises property reads and non-mutating methods that TypeScript resolves to native collections and strings, and Vitest’s imported asymmetric matcher factories such as `expect.objectContaining`. It still reports mutation, asynchronous work and unknown calls; `tests/no-expect-in-support` moves `expect` calls into the spec, except in test-support files that register tests at module top level and are not imported by any module, so nested Vitest runs can execute them as test files with real assertions. `tests/named-values` rejects numeric literals passed to `toBe` or `toHaveLength` in specs, except zero and process exit codes asserted on an `exitCode` subject: assert the observed items or use a domain name that comes from the story's inputs or the product. For HTTP statuses, import `* as HttpStatus` from `effect/http/HttpStatus` and use `HttpStatus.fromLiteral("NotFound")`; subjects named `status` or `code` do not exempt numeric assertions. A spec-local numeric const that only feeds these matchers is reported, including aliases for zero and codes. `tests/no-limit-imports` rejects importing `MAX_*` constants from a `limits` module into specs, so a story proves behavior instead of copying an implementation cap.

Three more rules keep a spec readable as a story, as the [story-testing skill](https://github.com/ShivaeDev/platform/blob/main/packages/skills/skills/story-testing/SKILL.md) describes. Together with `tests/spec-helpers`, `tests/named-values` and `tests/no-limit-imports`, they read files whose test declarations trace to a story kit, whatever their suffix: a `.test` or `.spec` file outside `test-support` that is not a type or unit test, such as `orders.spec.ts`, `pane.dom.test.ts` or `orders.slow.test.ts`. The suffix says where a test sits under `tests/follow`, not whether it is a story, and `tests/story-specs` already holds every such file to the story kit. They exempt the same test-story prerequisites as `tests/story-specs`. `tests/domain-outcomes` reports uses of Effect's `Exit`, `Cause` or `Result` modules, reads or destructuring traceable to their values and outcome literals tagged `"Success"` or `"Failure"`, including partial expectations: the kit's verb or readout returns the outcome in the domain's words, such as `"unauthorized"`, and a trait builds any failing input. A domain's own tagged schemas and durable event histories pass, including reads and destructuring of their `_tag` fields. `tests/grouped-outcomes` reports each run of two or more consecutive `expect(yield* …)` statements once, at its first statement: write the outcomes as rows of one `outcomes` call.

`tests/wait-on-events` checks those story specs and the `test-support/` modules reachable through their runtime imports, including aliases, re-exports and literal dynamic imports. It reports `Effect.sleep`, real timers (including browser and Node timer imports), wall-clock reads such as `Date.now()` and `performance.now()`, calls to the polling `eventually` from `@shivaedev/test/eventually.ts`, repeated state reads and loops without event consumption, Vitest's fake timers and `vi.waitFor`, including polling loops and quiet windows built from these calls. Local helpers are judged by their reachable bodies: consuming an event stream until a matching state arrives passes even when the helper is named `eventually` or `waitFor`. It accepts no config exceptions. Product modules keep their timers. `TestClock.adjust` and `TestClock.setTime` are reported in specs and accepted in support: when time passing is the behaviour, advance the controlled clock in a kit verb named for it.

Settle on the engine's own signal through a kit verb. A deadline bounds a failure but does not prove completion; reaching it must fail the story. The rule accepts failing Effect timeouts, a sleep piped directly into `Effect.andThen(Effect.fail(...))` or `Effect.andThen(Effect.die(...))`, and timeout callbacks that end by calling their enclosing Promise executor's rejection parameter. A resolving timeout or a sleep that ends successfully still guesses when the work is done.

`tests/positive-refusals` reports `.not.toBe` and `.not.toEqual` on a readout or field whose name ends in `outcome` (case insensitive), including locally stored readout aliases. In the same story, positively assert a concrete domain reason or public response on that same outcome with `toBe`, `toEqual`, `toMatchObject` or an `outcomes` row. For example, pair `expect(yield* submitOutcome()).not.toBe("saved")` with `expect(yield* submitOutcome()).toBe("unauthorized")`, or replace the negative check with the positive one. Another story, another outcome, an empty object or a boolean does not supply that evidence. The rule uses the same story-file scope and prerequisite exemptions as `tests/domain-outcomes`; it checks visible assertion syntax, while review establishes that a readout preserves unexpected failures.

`tests/queue-readouts` reports access to jobs-testing's `jobs` and `snapshot` readouts in tests and `test-support/`, including wrappers that return counts or job states. An enqueued job does not prove the work ran: assert the application's visible result instead. Worker controls and waits remain available. The check recognizes receivers named `jobsTesting`, controllers constructed with `makePgBossTesting` or annotated with the imported `PgBossTesting` type, local and imported aliases, destructuring and literal bracket access. It does not evaluate dynamic property names or arbitrary controller factories. The package named `@shivaedev/jobs` is exempt, at the repository root or wherever it lives in the workspace; test-kits also owns readout evidence under its `src/jobs/` and `src/test-support/jobs/` folders. Other test-kits domains and nested application packages remain checked. This rule refuses config exceptions and inline suppressions.

`boundaries/queue-sql` rejects SQL mentioning the private `pgboss.` schema. Apps use their queue definitions and let workers process jobs; there is no queue-purge API by design. `boundaries/auth-sql` identifies Better Auth storage from inventoried `CREATE TABLE` declarations in the configured owners or declarations with Better Auth column signatures (user email verification, provider accounts, session tokens and expiry, and verification values). SQL against those tables is reported even when the tables have been renamed. Schema-qualified identities stay distinct; an agent's durable `session` table is application data. A name alone does not establish auth ownership; keep the schema declarations in the inventory. App tables reference users by foreign key: migrations may reference only `user(id)` with `ON DELETE CASCADE` or `ON DELETE SET NULL`. Import `userReference` from `@shivaedev/identity/server/better-auth/userReference.ts` and interpolate `sql(userReference.table)` and `sql(userReference.column)` in the reference. Apps use identity for account data; `options.owners` names platform's own auth implementation and its migrations. These rules inspect SQL templates, literal query calls and query variables, and inventoried `.sql` files. They do not evaluate arbitrary runtime SQL construction.

`boundaries/http-status` rejects comparisons with HTTP error status numbers, switch cases and literal status-list membership outside `options.edge`. It recognizes numeric literals and `HttpStatus.fromLiteral("NotFound")`, for example. Domain code handles typed errors; the named HTTP edge translates them into transport responses. Process exit codes remain ordinary domain values.

Glob options (`toolOwned`, `content`, `edge`, `owners` and `suites`) use `{ glob, reason }` declarations. Every declaration needs a nonblank reason and must match a current inventoried file; otherwise configuration fails. Remove declarations when their files disappear. Paths and patterns are relative to the config's directory. Naming and suite options use gitignore patterns; `edge` and `owners` use Node glob patterns.

Declare these architectural facts in the repository's quality config:

```ts
export default defineConfig({
	rules: {
		"boundaries/auth-sql": {
			options: {
				owners: [{ glob: "src/auth/**", reason: "This module implements the auth storage API." }],
			},
		},
		"boundaries/http-status": {
			options: {
				edge: [{ glob: "src/http/**", reason: "These HTTP adapters translate transport statuses into domain errors." }],
			},
		},
	},
});
```

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

`tighten` lowers entries for files changed since `HEAD`; `--staged` restricts those updates to staged files. `prune` considers every baseline entry. Both read all shards, only lower or remove counts and carry entries to the destination shard when git detects tracked moves. They also remove empty shards left by content merges. Unchanged entries stay in their existing shards, with unrelated lines preserved.

When a Quality upgrade adds a check, or a reviewed change needs to record one rule's findings again:

```sh
quality baseline write --rule tests/story-setup
```

Keep the default error level. The command replaces that rule's entries across all files; every other rule's entries stay unchanged. Omit `--rule` to record every finding. Review the recorded cases using the guidance printed after each write. The [debt and hook guide](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/debt-and-hooks.md) covers the baseline format, exception subjects, limit changes, renames and commit checks.

### Baseline merges

Register the driver in `.gitattributes`:

```gitattributes
/quality-baseline.jsonl merge=quality-baseline
/packages/*/quality-baseline.jsonl merge=quality-baseline
```

Run `quality baseline install-driver` from your checkout's setup script. It sets only repository-local `merge.quality-baseline.driver`; it leaves other Git settings alone. Each checkout needs the setting because Git does not copy local configuration when cloning.

Git calls `quality baseline merge <ancestor> <current> <other>`. Entries are keyed by path and rule. Removing an ancestor entry on either side removes it from the result; retained counts take the minimum of the two sides, and entries newly added on either side survive. When both sides record a split rule's `deep` share, the fast share (`count` less `deep`) and the deep share each take their minimum and `count` is their sum; when either side lacks it, the counts merge as before and the result has no `deep`. The command writes the result to `<current>`, so parallel reductions of neighbouring entries merge without a text conflict.

### Unused code

`code/unused` uses knip to report unused files, value and type exports, unused dependencies (including development and optional peer dependencies), and imports missing from the package manifest in every workspace. It runs through `quality lint` and the normal report and baseline. The rule accepts no options or permanent exceptions; Quality supplies knip’s entry points without a repository knip config. It follows package scripts through their imports to esbuild `build`, `buildSync` and `context` calls, Rolldown `build` and `watch` calls (including config arrays), and `Bun.build`, reading literal entry lists or maps, local constants, array spreads, arguments passed through local or imported build helpers, mapped config array elements, builds inside Effect acquisition callbacks, and Node path `join`, `resolve` and `dirname` calls, including `fileURLToPath(import.meta.url)`. Conventional tool configs, including dependency-cruiser configs and nested Vitest configs, are entries too, and so is `.railway/postgres-schedules.ts`, which `@shivaedev/deploy` loads from its default path; `files/named-after-export` lets it keep that name. Other modules in `.railway/` are checked as usual. Relative paths use the script package’s working directory (or esbuild’s `absWorkingDir`); `import.meta.dirname` and `__dirname` refer to the build helper’s folder. Node path calls use the script package’s process directory even when the bundler sets a different working directory. Entry files and their imports count as used without fake imports. Package names in a traced build's `external` option, including a list imported from another module or narrowed with `.filter`, count as use of the bundling package's declared dependencies, because the bundle imports them at runtime. Node module resolution through `createRequire(...).resolve(...)` also counts as dependency use; an ordinary object’s `resolve` method does not. Unrelated strings and entries in abandoned build helpers do not establish reachability. Runtime modules supplied by a host can be declared in an ambient script included by the importing file’s TypeScript project. These declarations satisfy the missing-dependency check only in that project; undeclared imports still fail. A package that exports only `./package.json` and holds no sources ships no code, so the rule accepts every dependency it lists.

Declare files reached only through runtime-built paths with repository-relative `entries` paths or globs. Quality passes these entries to knip, so the files and their imports count as used. A path or glob that matches no file fails the run and names the unmatched pattern. This covers spawned scripts and roots chosen at runtime:

```ts
export default defineConfig({
	entries: ["script/perf/driver.ts", "script/workers/**/*.ts"],
});
```

Package `exports` are public API, including wildcard targets and source conditions. Package `bin` and scripts, test and story globs, tool configs and `src/test-support` provide the other entry points. Imports reachable from those entries count as used. Source-conditioned package import aliases resolve to their sources before a build. Compiler mappings from `tsconfig.json` and `tsconfig.build.json` keep imports on their source files when build output exists. An internal module can be used while one of its exports remains unused. An application’s declared dependency entry points satisfy provided imports under the same policy as `imports/manifest`.

When Knip cannot produce a valid report, including when a tool config such as `prisma.config.ts` throws because `DATABASE_URL` is missing, `code/unused` reports one finding on the root `package.json` with the tool’s output and repair guidance. The other rules still run. This finding means unused-code analysis did not complete; repair the failure and rerun the gate.

For adoption, run `quality baseline write --rule code/unused` and review the recorded debt. Burn it down by deleting unused code, removing unused dependency declarations, declaring missing dependencies, or connecting code to a real entry point. Run `quality baseline tighten` after repairs, or `quality baseline prune` across the repository. Do not add an entry point just to hide dead code.

### What the rules check

`quality lint` prints each failing rule's guidance with its findings, so the finding is the reference for what to change. The built-in rules fall into these groups:
- **Structure:** `structure/max-lines` allows 150 lines in a source file and 300 in test code, `nesting/max-depth` rejects lines indented eight tabs deep, and `structure/no-barrel` rejects `index` modules, exported value aliases (including `typeof` annotations and local const chains), facades of imports and functions that only forward their parameters unchanged to an import. Wrappers that supply explicit type arguments, such as `() => createColumnHelper<Feature>()`, and overloaded adapters keep their own meaning. The preset rejects bare type aliases of named or default imports as well as explicit type re-exports; each repair names the defining module. When `noExportedImports` suggests `export … from`, import the name where it is used instead. A module does one job.
- **Comments:** the `comments/*` rules reject JSDoc, TODOs, banners, line and pull request references, environment pragmas and more than two comments per file. A comment says why, never what the code already says or what it used to be. A tool pragma such as `@jsxImportSource` counts as a comment until both `comments/no-jsdoc` and `comments/max-per-file` list its tag in their `allow` option.
- **Documentation:** `docs/references` checks every Markdown file in the sources except `CHANGELOG.md`, whose released history keeps the links of its release. Relative links, reference definitions and `href`/`src` attributes reach an existing file or folder inside the repository, and a heading anchor matches one GitHub forms from the target's headings. A link to the repository's own GitHub tree, named by the root `package.json` `repository` field, is checked like a relative one unless it is pinned to a commit or a release tag. A published workspace package's README is shown on npm without the repository around it, so its links that leave the package use absolute URLs. Imports in TypeScript and JavaScript code blocks, workspace module paths such as `@scope/lib/repository.ts` written as inline code, `` `name` from `module` `` phrases and a package README's API rows resolve through the owning package's `exports` to an exported module, and every named import exists in that module unless it re-exports another. A linked document such as `CLAUDE.md` beside `AGENTS.md` is checked once, through its target. `docs/unversioned-installs` rejects a version after a package name in install commands, in shell code blocks and inline code; the package's own version ranges decide what installs, and a written version goes stale with the next release. A dist-tag such as `latest` passes.
- **Hidden casts:** `suppressions/no-double-cast` also checks code outside `adapters/` and `test-support/` for concrete annotations on `JSON.parse` results, unchecked `Reflect.get` bindings, SQL tagged-template row generics, identity overloads whose implementation returns `unknown`, context retagging through `Context.makeUnsafe(...mapUnsafe)`, and writes to readonly properties or native Scope state. Keep untrusted values as `unknown` and decode them with `Schema.decodeUnknownEffect`; decode SQL rows with `SqlSchema` rather than declaring their shape. Give an identity implementation its declared return type, preserve the Context service type, and use native constructors or lifecycle operations instead of changing native fields. Constructor initialization, mutable object writes and extensions that do not replace readonly fields are accepted, and so are writes on a freshly built object: `Object.assign(new X(...), ...)`, and `Object.assign` or `Object.defineProperty` on a local `const` initialised with `new X(...)` in the same function that nothing has used before the write. An object the caller supplied, or one a conditional might have come from the caller, is still reported. Double casts and the hidden casts visible in syntax run on every lint; readonly writes and SQL row generics on a tag other than `sql` need TypeScript declarations and run in the rule's deep half, in CI and with `quality lint --full`. These checks do not prove that arbitrary helper functions validate their input.
- **Suppressions:** the `suppressions/*` rules reject inline lint and compiler directives, casts through `unknown`, `any` or `never`, Biome settings that weaken a check and `ignoreDeprecations`. None of them takes exceptions. A type test (`*.typecheck.test.ts`) may use `@ts-expect-error`; a test that must pass a rejected value at run time calls the API through `Reflect.apply`.
- **Imports:** cycles, unresolvable imports, workspace imports missing from the manifest or an entry point, relative imports of own modules (including same-folder files and registration subtrees; use the package’s `#` aliases, except between tool configs directly in a package's folder, such as `vitest.coverage.config.ts` importing `./vitest.config.ts`, which no alias reaches), production imports of test code, runtime folders and fences, as described above.
- **Names and files:** `files/folder-names` accepts an unscoped package name matching any trailing run of its folder path joined with hyphens, with singular or plural segments. For example, `packages/server/domains/agents` accepts `domain-agents` or `agents`, and `apps/testing` accepts `app-testing`; unrelated or stale package names still fail. The Biome preset's naming rules and plugins, together with the remaining `files/*` rules, name a file after its main export with its folders as the prefix. Root authority documents such as `DESIGN.md`, `ARCHITECTURE.md` and `GLOSSARY.md` are accepted beside `AGENTS.md`. `files/named-after-export` accepts programmatic bundler entries, including main and preload adapters, and tool-discovered config names such as `.dependency-cruiser.ts`. Tool config recognition follows the shared Biome default-export policy, so these configs may also use their required default export. The Quality gate also accepts Vitest configs and reporters named by explicit `--config` or `--reporter` paths in package scripts, and plugins whose default export implements an imported foreign Plugin type. Ordinary modules retain their naming and default-export checks. `files/named-after-export` names a constants module in camelCase for what its exported data shares: `maxItems.ts` exports `MAX_ITEMS`, `timeouts.ts` holds `INSPECT_TIMEOUT_MILLIS` and `REMOTE_TIMEOUT_MILLIS`, `limits.ts` holds constants carrying max, min or limit, and `defaults.ts` holds constants carrying default. Each constant must carry every word of the module name, singular or plural; split unrelated constants or put heterogeneous copy in a single exported record named after itself. Only literal data, arrays and objects of it, and CONSTANT_CASE references count, with types derived from those constants allowed. Schemas, Layers, services, Effects, functions, classes and computed values stay runtime exports. One remaining runtime export names the file even beside constants; two or more use a camelCase topic file. Private constants do not name a file. The same model applies in `src/test-support`. It keeps the export’s full name while the file name omits words already supplied by any folder above it. In `spaces/client/`, a component exporting `CreateSpace` lives in `Create.tsx`: `spaces/` supplies “Space” even across the intervening `client/` folder. Keep the export named `CreateSpace`; `CreateSpace.tsx` would repeat a folder name. Inside a module’s `client/admin/` or `server/admin/` subtree, file names may repeat words from above `admin/`: `src/modules/inbox/client/admin/inboxRoutes.ts` may export `inboxRoutes`. Names must still match their exports and omit words repeated by folders within the admin subtree. No naming rule renames anything; the author picks the name. A name an outside system owns, such as a query parameter or an environment variable, is written as a quoted key, which the naming rules skip. A `Schema.Struct` field stays camelCase even when quoted and maps to the outside name with `Schema.encodeKeys`. Biome's naming messages print only a pattern: spell acronyms as words (`HttpClient`, `userId`, `parseUrl`) rather than turning off `strictCase` as its hint suggests, give a type no `I` prefix, and name a type parameter `T`, `T` plus a PascalCase name (`TItem`), or Effect's `A`, `E` and `R`. No rule checks these, so review does: a boolean reads as a question (`isOpen`, `canRetry`) unless the DOM or React names it (`open`, `disabled`); a schema shares its name with its type (`type Item = typeof Item.Type`); an unused parameter is removed rather than renamed with the `_` prefix TypeScript accepts. The naming rules take repository facts: `options.toolOwned` lists `.gitignore` patterns whose names a tool fixes, and a configured list extends the rule's defaults, so list only repository-specific additions; `content` lists snake_case content folders and files; `tests/follow` and `tests/colocated` take `suites` for test folders with their own layout, such as a Playwright suite.
- **Change keys:** `boundaries/imported-change-keys` reports literal collection and bucket names in Reactivity invalidations and mutations, SQL `invalidateOnCommit`, and the `changes` key encoders. Import the owning declaration and use its name, list, item or bucket key. Literal record IDs and bucket values are accepted, as are names at their collection declaration.
- **React:** `react/jsx-conditionals` reports `&&` and ternaries in the JSX children a component returns, including nested decisions and returned `.map` items. Decisions in a `const` above the return, JSX built inside library callbacks and conditional attributes are accepted. A ternary with two plain string or number literal branches, such as `{on ? "On" : "Off"}`, is accepted; branches that select JSX, components or computed values still need a decision before the JSX. This rule owns the check, so the shared Biome preset leaves `noLeakedRender` off.
- **Tests:** `tests/follow` and `tests/colocated` keep a test beside the code it covers, named `<file>[.<modifier>].test.ts` or `<behaviour>[.<modifier>].spec.ts` with at most one modifier of `dom`, `slow`, `typecheck` and `unit`; a unit test runs without the DOM, so `.unit.dom` is rejected. A package-owned `test/` tree beside its `src/` is an accepted suite: `.test` files follow the corresponding `src/` path, and `.spec` files name behaviours there. This works for workspace members and standalone packages. Outside those trees, `tests/colocated` always treats `__tests__/` as a test folder. It treats `test/`, `tests/` and `spec/` as test folders only when their directly contained checked files are all tests or test support; a product folder with source beside its specs is an ordinary source folder. Declared `suites` keep their own layout. Shared test support belongs in `test-support/`, the sanctioned test-only folder. A test covering a whole module may sit at its root or directly beside its folder. The story rules above keep setup in the kit.
- **Manifests:** `manifests/valid` decodes every repository `package.json` through one shared Schema before dependent rules run and reports each invalid manifest once with its file path. An unreadable manifest or one removed after discovery becomes a `manifests/valid` finding. Optional lookups still treat `NotFound` as absence. `manifests/sorted` keeps every `package.json` in sort-package-json order, and `manifests/source-first` puts the `@shivaedev/source` or `source` condition first in `exports` and `imports`. `manifests/exports-shape` checks the package root and workspace members. They use one file-preserving TypeScript wildcard: for example, `./*.ts` maps to `./src/*.ts`, `./dist/*.d.ts` and `./dist/*.js` under `@shivaedev/source` (or an application’s own `source`), `types` and `default`. Packages with `"private": true` may instead map the wildcard directly to source (`"./*.ts": "./src/*.ts"`), or use `"./*": "./src/*"` to preserve both `.ts` and `.tsx` extensions; published packages require the full source, types and default conditions. A subtree pattern such as `./server/*.ts` keeps that same subtree in its targets. An optional root entry and exact-path non-code assets such as JSON presets and `./package.json` are allowed. Every module remains importable; `null` export entries fail with a request to remove the block. A package without modules, such as a dependency shell, exports only exact assets and needs no wildcard. Import each module at its path under `src/`; named aliases, flattened paths, per-file module lists and additional wildcards fail. When declared, the standard imports must preserve their roots: `#*.ts` maps directly to `./src/*.ts` or uses `@shivaedev/source` (or an application’s own `source`) `./src/*.ts`, types `./dist/*.d.ts` and default `./dist/*.js`; `#test/*` maps to `./src/test-support/*`, and private packages may also map it into their own `test/`, `tests/` or `test-support/` tree outside `src/` (for example, `"#test/*": "./test/support/*"`). Include subfolders in specifiers, such as `#server/module.ts`. Other aliases are allowed. `manifests/application` keeps an application on its entry points, as described above.
- **Biome:** the `biome` rule reports Biome's error findings as `biome/<category>`. A Biome run that fails without an error finding, such as one whose config leaves no file to check, fails lint and fix with Biome's message. The preset leaves out the `.worktrees` folder at the root, so a checkout does not lint its linked worktrees, while a worktree inside it lints all of its own files. The preset's plugins ban ambient time, randomness, `console` and `process.env` in favour of Effect's services. The preset runs every rule Biome recommends at `error`, apart from the rules its shipped declarations weaken; Quality's own suite checks that against the installed Biome, so a lint does not.

### Decide before JSX

Replace a child decision such as `<section>{ready && <Content />}</section>` with an early return:

```tsx
function Panel({ ready }) {
	if (!ready) return null;
	return (
		<section>
			<Content />
		</section>
	);
}
```

Replace `<section>{ready ? <Content /> : <Loading />}</section>` with content computed above the return:

```tsx
function Panel({ ready }) {
	const content = ready ? <Content /> : <Loading />;
	return <section>{content}</section>;
}
```

JSX built in a `const` above the return is also accepted:

```tsx
function Panel({ ready }) {
	const content = <section>{ready && <Content />}</section>;
	return <main>{content}</main>;
}
```

Conditional attributes are accepted:

```tsx
function Panel({ ready }) {
	return <section className={ready ? "active" : "idle"} />;
}
```

Library callbacks make their own rendering decisions. A chart formatter is accepted:

```tsx
function Chart() {
	return <Library formatter={(value) => <span>{value ? <Content /> : null}</span>} />;
}
```

Replace `<ul>{items.map(item => item.visible ? <li key={item.id}>{item.name}</li> : null)}</ul>` with an item component that receives the data and returns `null`:

```tsx
function Item({ item }) {
	if (!item.visible) return null;
	return <li>{item.name}</li>;
}

function List({ items }) {
	return (
		<ul>
			{items.map((item) => (
				<Item key={item.id} item={item} />
			))}
		</ul>
	);
}
```

To join rendered items with a separator, decide the separator in a `const` before the item return:

```tsx
function List({ items }) {
	return (
		<>
			{items.map((item, index) => {
				const separator = index > 0 && ", ";
				return (
					<span key={item.id}>
						{separator}
						{item.name}
					</span>
				);
			})}
		</>
	);
}
```

### API

Import names from their defining module; there is no root entry. The package's `./*.ts` export pattern also exposes the gate's implementation modules; the following table lists the config, tool and extension entry points:

| Module                        | Exports                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.ts`                   | `defineConfig`, `QualityConfig`, `Level` (`"error"`), `RuleSetting`, `RuleSettings`, `BuiltInRules`                                         |
| `rule.ts`                     | `defineRule`, `Rule`, `RegisteredRule`, `Configured`, `Finding`, `Findings`, `SourceFile`, `RuleInputs`, `RuleContext`, `TypeScriptProgram` |
| `adapters/standardSchema.ts`  | `StandardSchemaV1`, `StandardResult`, `StandardIssue`, `describeIssue`                                                                      |
| `imports/fence.ts`            | `fence`                                                                                                                                     |
| `imports/fences/selectors.ts` | `packages`, `folders`, `files`, `modules`, `scopes`, `anyOf`, `workspace`, `anything`, `external`                                           |
| `imports/fences/model.ts`     | `Fence`, `Target`, `Selector`, `Prohibition`, `Examples`, `Chain`, `ExampleStep`, `External`                                                |
| `adapters/testProjects.ts`    | `testProjects`, `TestProjectsOptions`                                                                                                       |
| `naming/testName.ts`          | `testName`, `isTestCode`, `isTestSupport`, `ENVIRONMENTS`, `Environment`, `TestName`                                                        |

#### Config

| Key                | Default                                                      | Meaning                                                                                                               |
| ------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `sources`          | `["."]`                                                      | Directories or files the source rules check, relative to the repository root.                                         |
| `nonEffectFolders` | `[]`                                                         | Explicit folders whose descendants are not Effect code; other quality rules still apply.                              |
| `extensions`       | `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs` | Source extensions.                                                                                                    |
| `baseline`         | `quality-baseline.jsonl`                                     | Root shard for paths outside packages; package shards use `packages/<package>/quality-baseline.jsonl`.                |
| `exceptions`       | `[]`                                                         | Permanent exceptions as `{ files, rules, reason, subject? }`.                                                         |
| `registry`         | `quality/registry.json`                                      | Legacy input for upgrades; run `quality exceptions migrate`.                                                          |
| `local`            | `[]`                                                         | Exposed extension API for rules made with `defineRule`; not required for adoption.                                    |
| `rules`            | Every rule at `error`                                        | Options by rule id, such as import boundaries. An explicit `error` or `{ level: "error", options }` is also accepted. |
| `preCommit`        | `"full"`                                                     | `"staged"` makes the pre-commit hook check only the staged files with Biome, except in a Claude Code cloud session.   |

#### Local rules

The exposed local-rule API supplements the gate; a repository does not need to use it to get the shared policy. Reusable quality policy belongs in Quality itself.

```ts
import { Effect } from "effect";
import { defineRule } from "@shivaedev/quality/rule.ts";

export const noLog = defineRule({
	check: ({ sources }) =>
		sources.filter((file) => file.text.includes("console.log")).map((file) => ({ file: file.path, message: "logs to the console." })),
	description: "Log through the logger.",
	id: "local/no-console-log",
});

export const hasChangelog = defineRule({
	check: ({ readText }) =>
		Effect.gen(function* () {
			const text = yield* readText("CHANGELOG.md");
			return text === undefined ? [{ file: "CHANGELOG.md", message: "is missing." }] : [];
		}),
	description: "Keep a changelog.",
	id: "local/has-changelog",
});

export const noAnyExports = defineRule({
	check: ({ sources, typeScript }) =>
		Effect.map(typeScript, ({ checker, sourceFile, ts }) =>
			sources.flatMap((file) => {
				const source = sourceFile(file.path);
				const module = source === undefined ? undefined : checker.getSymbolAtLocation(source);
				return (module === undefined ? [] : checker.getExportsOfModule(module))
					.filter((exported) => (checker.getTypeOfSymbol(exported).flags & ts.TypeFlags.Any) !== 0)
					.map((exported) => ({ file: file.path, message: `exports ${exported.name} typed as any.`, subject: exported.name }));
			}),
		),
	description: "Give every export a known type.",
	id: "local/no-any-exports",
});
```

Register them with `defineConfig({ local: [noLog, hasChangelog, noAnyExports] })`. A check receives `root`, checked paths in `files`, source files in `sources`, `readText(path)`, `typeScript` and decoded `options`, and returns findings or an Effect of findings. `readText` is an Effect that succeeds with `undefined` for a missing file. `typeScript` is an Effect of a TypeScript `program` and its `checker` over the scanned sources, with `sourceFile(path)` looking up a source by its repository path and `ts`, the TypeScript module that built the program. A rule reads syntax kinds, flags and type guards from that `ts` and does not import its own `typescript`, whose version can differ. Every rule in a run that yields it receives the same program, built at most once and only when a rule asks for it. The program is `strict`, allows JavaScript, preserves JSX, targets ESNext with its default library, skips library checks and loads no ambient `types`; imports resolve through each file's nearest `tsconfig.json`, so types from installed packages are their real declarations. TypeScript 6.0.3 throws "Debug Failure. No error for last overload signature" when it resolves some calls to a large overloaded generic function with a callback argument whose types come from installed packages, such as a story kit's `it` with a story callback; asking for the callback parameter's type resolves that call. TypeScript 7 checks the same code without error. A caught failure leaves the checker unusable, so the run stops with the rule's id and the compiler's stack. For options, provide a [Standard Schema](https://standardschema.dev) validator; an absent options object is validated as `{}`, so defaults belong in the schema, and a rule without a schema refuses options. A finding's optional `subject` distinguishes exceptions within a rule and file. A limit rule reports its amount over the limit as `count` and the limit as `threshold`; the baseline stores the count. Set `registrable: false` when a rule must never be excused by a config exception. Set `depth: "deep"` when a rule is too costly for every local lint; CI and `quality lint --full` still run it. When only part of a rule is costly, give it `deepHalf: { check, name }` instead: `check` is the fast part, `deepHalf.check` runs only where deep rules run, both report under the rule's id, and a fast run's closing line names the skipped half as the rule id followed by `name`. The two halves must not report the same finding. `needs` names what a rule takes from the run: `"story-program"` puts it among the rules that read the story program, which the run builds once for them and drops after the last of them, whatever their tier; `"child-process"` marks a check that runs a child process, such as Biome or Knip. A run starts Biome and Knip before the other rules, so their child processes work while the rules in Quality's own process run.

#### Command line

```text
quality lint [--config <file>] [--fast | --full]
quality ci [--coverage]
quality fix [--config <file>]
quality exceptions migrate [--config <file>] [--from <registry>]
quality baseline merge <ancestor> <current> <other>
quality baseline install-driver
quality baseline write [--config <file>] [--rule <id>]...
quality baseline prune [--config <file>] [--against <ref>]
quality baseline tighten [--config <file>] [--staged]
quality baseline migrate [--config <file>] [--from <file>]
quality hooks install [--config <file>] [--force]
quality hooks uninstall
quality hooks status
quality hooks pre-commit [--config <file>]
```

Baseline JSON Lines entries may include a non-empty `reason` explaining retained debt. Lowering or moving an entry keeps its reason.

`quality` alone runs lint. The commands above use the default error-level policy. `prune --against` follows renames since the target's merge base; without a target it tries `origin/HEAD`, `origin/main`, then `origin/master`, and prunes without following moves when no merge base is available. An explicit target with unavailable history fails; fetch the needed history before rerunning. `migrate` splits a single JSON Lines baseline into shards, or converts an earlier JSON baseline into sharded JSON Lines. Use `--from quality/baseline.jsonl` for an existing single-file baseline. It removes the source after writing the shards.

| Exit code | Meaning                                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `0`       | Passed. Retained debt or loose baseline entries may remain.                                                                      |
| `1`       | Failed: uncovered errors, stale exceptions or baseline entries for unknown or disabled rules.                                    |
| `2`       | Could not run: invalid input or config, missing files or git history, a failed rule, fixes that do not settle, or invalid usage. |

### Install, shared tooling and limits

```sh
pnpm add --save-dev @shivaedev/quality @effect/platform-node @effect/platform-node-shared effect
```

Node 24 or later is required. The CLI loads the TypeScript config through Node's native import; use erasable syntax and declare `#` aliases in package.json for its own-module imports.

The package includes `@shivaedev/quality/biome/preset.json`, `@shivaedev/quality/tsconfig/base.json` for type-checking with `noEmit`, and `@shivaedev/quality/tsconfig/package.json` for package builds, which adds declarations, maps and `rewriteRelativeImportExtensions` so relative `.ts` imports are emitted as `.js`, and resolves modules as `NodeNext` so emitted declarations name the files Node and TypeScript consumers resolve. Type-checking stays on `bundler` resolution, so an emit problem surfaces in the build rather than in `tsc --noEmit`. Read the preset files for their settings. The preset's plugins load from `./node_modules/@shivaedev/quality/biome/preset.json/plugins`, so install the package at the repository root. Biome sorts a specifier that starts with `#`, `@/`, `~`, `$` or `%` as an alias; a tsconfig path such as `@app/*` sorts with the packages and Biome's `noUndeclaredDependencies` takes it for one, so name aliases in a form Biome recognizes.

The TypeScript base leaves `types`, `jsx`, `paths`, `include` and output directories to each project. A project that needs more built-ins, such as the DOM, sets `lib` itself and keeps `ESNext` in it. A package that type-checks its tests with one config and builds `src` with another extends both, the package preset last:

```json
{
	"extends": ["./tsconfig.json", "@shivaedev/quality/tsconfig/package.json"],
	"compilerOptions": { "outDir": "dist", "rootDir": "src" },
	"include": ["src"]
}
```

For a React browser app, extend `@shivaedev/quality/tsconfig/app.json` instead. It adds React JSX, browser libraries and the Node, React and React DOM types to the base. Keep the application's paths and input files in its own config.

An application built on Platform takes its Vite and Vitest setup from [`@shivaedev/build`](https://github.com/ShivaeDev/platform/tree/main/packages/build#readme), which builds its Vitest config on `testProjects`.

For Vitest, install `vitest`, and add `@shivaedev/test-story` and `happy-dom` when the repository has DOM tests, then use:

```ts
import { testProjects } from "@shivaedev/quality/adapters/testProjects.ts";
import { defineConfig } from "vitest/config";

export default defineConfig({ test: testProjects() });
```

`testProjects` selects four projects by default: `unit` runs ordinary Node tests and specs, `pure` runs `.unit.test` and `.unit.spec` files in Node, `dom` runs `.dom` tests and specs in test-story's DOM environment, and `heavy` runs `.heavy` tests and specs in Node. Heavy files run one at a time after the ordinary projects finish, including across packages in a workspace run. Use `.heavy` for tests that spawn CPU-heavy toolchains. The `pure` project always installs an I/O guard: calls to Node's `fs` (including `fs/promises`), `net`, `http`, `https`, `child_process` and `worker_threads` modules and global `fetch` throw an error naming the unit file and call. The guard also patches ESM named imports while preserving Node and Vitest module loading. Keep unit tests pure; test I/O through the package's story kit. Use `--project pure` to run only unit files, or `--project unit` for ordinary Node files. The DOM environment keeps Node's host constructors separate from the happy-dom window, so DOM specs need no project remap. Each test gets 30 seconds instead of Vitest's 5, because tests that start servers, browsers or CLIs take seconds on a busy CI runner. `.slow` tests run only when `--project slow` asks for them. Type tests are excluded from Vitest and belong in the compiler's input. Every project excludes `**/.worktrees/**` so a checkout does not collect specs from its worktrees.

Worker concurrency in `testProjects` comes from a configured PostgreSQL connection budget, independent of CPU count: `max(1, floor(connectionBudget / connectionsPerWorker))`. The defaults are 80 usable connections and 14 connections per worker, giving five workers. The budget leaves room on a typical 100-connection server for administration and other clients; the estimate allows for full-app tests with several pools. Set the budget from your server's `SHOW max_connections`, subtracting connections reserved for other clients and concurrent test processes. Quality does not query the server. If even one worker exceeds the budget, it still runs one worker; reduce that test's pool sizes or increase the server capacity.

Set the per-worker estimate to the peak connections held by one test worker, and supply your usable budget or an explicit worker override:

```ts
testProjects({ connectionBudget: 84, connectionsPerWorker: 14 });
testProjects({ maxWorkers: 4 });
```

The first configuration allows six workers, including on a two-CPU runner. `maxWorkers` takes precedence over the connection calculation. Counts and estimates must be positive safe integers. Vitest's native `--maxWorkers` CLI option can also override the returned configuration for a single run.

Coverage is opt-in: `testProjects({ coverage: true })` enables Vitest's V8 provider across the selected projects. Quality supplies `@vitest/coverage-v8` at its supported Vitest version. The report includes unvisited `src/**/*.ts` and `src/**/*.tsx` files and excludes declarations, tests, specs and `test-support`. To customize it, pass native Vitest coverage options, for example `testProjects({ coverage: { reporter: ["lcov", "text-summary"] } })`. No separate coverage config is needed.

Outside CI, `testProjects` sets `silent: "passed-only"` so local runs show logs only from failing tests. When `CI` is set to a nonempty value, it sets `silent: false` so CI keeps all test logs. It leaves `reporters` unset so Vitest can auto-detect its agent reporter. If a repository adds a reporter, spread `configDefaults.reporters` instead of replacing the defaults:

```ts
import { testProjects } from "@shivaedev/quality/adapters/testProjects.ts";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: { ...testProjects(), reporters: [...configDefaults.reporters, "junit"] },
});
```

#### PostgreSQL URL gate

A skipped test proves nothing. `noSkippedTests` reports unconditional skips as errors, and its automatic fix is disabled: repair the test or remove a claim it cannot prove. Slow tests belong in the slow project.

`tests/database-url` reports direct `Config` string, redacted and URL reads and `process.env` reads of names ending in `DATABASE_URL` inside `test-support/`. It follows imports and static const aliases, including bracket access and environment destructuring. Use `postgresTestUrl` instead. Environment writes, child-app source strings and forwarding the environment to a generated app are accepted.

The **PostgreSQL URL gate** is the only permitted skip convention: a test that needs real PostgreSQL registers conditionally on its `PLATFORM_*_TEST_DATABASE_URL`. Use `postgresTestUrl(name)` from `@shivaedev/test-sql/server/adapters/postgresTestUrl.ts` at collection time. It returns `{ url, configured }`, treats absent and empty URLs as missing, and throws when a URL is missing and `CI` is nonempty. With a URL, execute the body against PostgreSQL and let connection or setup failures fail the test. Nothing else may skip. Keep the condition next to the database setup, either in the test file or its shared `test-support` module:

```ts
import { test } from "vitest";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";

const { configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");
const integration = test.skipIf(!configured);
```

Declare the real PostgreSQL tests with `integration(name, body)`, or pass `configured` as a story kit's `runIf`. CI must supply the URL for every such test; a green run with missing URLs gives no PostgreSQL evidence.

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

A file that renders trusted HTML or SVG from a renderer adapter can use the same reasoned declaration path. Declare the explicit file once in `quality.config.ts`:

```ts
export default defineConfig({
	exceptions: [
		{
			files: ["src/Diagram.tsx"],
			reason: "The renderer adapter produces the trusted Mermaid SVG.",
			rules: ["biome/lint/security/noDangerouslySetInnerHtml"],
		},
	],
});
```

Only the declared files accept `dangerouslySetInnerHTML`; undeclared files keep the check. This records the consumer's trust decision and does not inspect or sanitize renderer output.

Quality merges the Biome settings at lint and fix time; do not add or mirror an override in `biome.json`. Files are explicit repository paths. Biome exceptions cover individual lint rules or assist actions; whole checks, rule groups and globs are rejected. `biome/files/includes` is the directory exclusion form: keep `**` and list negative patterns naming directories, such as `!**/test-support/generated`. Quality's shipped exceptions are part of its internal policy. [Exceptions and upgrades](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/debt-and-hooks.md#exceptions) describes subjects, stale entries and the upgrade command.
- The source inventory and Biome have their own scopes. `quality fix` runs Biome from the config's folder; it is not restricted to the source-rule inventory.
- The installed hook checks files on disk, not only what is staged, unless the config sets `preCommit: "staged"`. It uses each committing worktree's config and dependencies. Installation sets repository-local `core.hooksPath`; the hook chains an executable global pre-commit hook without changing global configuration. Either hook's failure blocks the commit. `quality hooks status` reports when git's effective hooks path does not run Quality.
- Workspace imports require a declaration in the importing package’s `dependencies`, `peerDependencies` or `optionalDependencies`. Tests, `test-support`, package-owned `test/` trees beside `src/`, private test-composition packages, package-root tooling folders (`script`, `scripts`, `tooling`) and package-root config files may also use `devDependencies`. Executables and public modules keep their imports in the runtime boundary.
