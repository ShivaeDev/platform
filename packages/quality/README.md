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

### Effect boundaries and services

`effect/boundary` checks every TypeScript or JavaScript source in Quality's inventory, including shipped code, tooling and specs. It reports async functions, methods and arrows, await (including `for await`), `new Promise(...)`, `.then(...)`, try statements and throw statements. Model the work with Effect, fail with a tagged error, and use `Effect.die` for defects. Effect's resource and finalizer primitives model cleanup.

Only folders named `adapters/` or `test-support/`, at any depth, are exempt from this boundary rule. An `adapters/` folder bridges an outside library and hands the rest of the application Effect values. The name is fixed by convention, with no config or copied Biome plugin globs. Code that cannot be Effect belongs in that bridge or calls for a better Effect primitive. Adapter code still follows `effect/service-parameters` and the ambient time, randomness, console and environment bans.

`effect/service-parameters` reports parameters carrying a service in exported functions and public methods, including returned factories. It follows service classes and tags, non-empty Contexts and service implementation shapes through aliases, interfaces, generic constraints, inferred parameters and destructuring. Read services from Effect's environment instead. An Effect or Stream requiring a service is a computation and is accepted. Methods implementing a service and functions constructing Layers may take services as parameters. Only `test-support/` folders are exempt from this rule; `adapters/` folders are checked.

Both rules refuse config exceptions and inline suppressions. Record existing debt with `quality baseline write --rule effect/boundary` and `quality baseline write --rule effect/service-parameters`; the normal report and baseline burn-down apply.

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

The optional pre-commit hook runs Quality's lint, then the `typecheck` script when it exists, then an optional `quality:commit` script for repository checks. It uses the manifest's `packageManager` (`npm`, `pnpm`, `yarn` or `bun`), defaulting to `npm` when omitted. Add `quality:commit` only when the repository has extra commit checks.

Inspect the report and install the optional commit check explicitly:

```sh
quality lint
quality hooks install
```

For an application setup script, use `quality setup`. It installs the same hook when the current folder has its own `.git` entry, including a linked worktree. An unversioned app or an app inside another repository leaves hooks alone.

Installing the package does not install a hook. `hooks install` writes the repository's pre-commit hook. A hook Quality did not write is kept unless `--force` replaces it. For an existing repository, `quality baseline write` records error-level findings when there is no baseline; it refuses to regenerate an existing baseline without `--rule <id>`.

Add a config only when the repository needs to supply facts such as source locations or import boundaries:

```ts
import { defineConfig } from "@shivaedev/quality/config.ts";

export default defineConfig({ sources: ["src"] });
```

When a config exists, its folder is the root for paths and hook scripts. Without one, the current directory is the root. `sources` chooses the files the source rules read; a missing source stops the run. Directory discovery skips untracked files ignored by git through `.gitignore`, `info/exclude` or `core.excludesFile`, and the `.git`, `.worktrees` and `node_modules` directories. Tracked files remain checked even when an ignore pattern matches them; a folder named `generated/` does not exempt authored code. Some repository rules, such as manifest sorting, inspect the whole repository even when `sources` names only `src`.

Quality discovers each app’s `components.json` and resolves `aliases.ui` through its TypeScript paths or package imports. That folder belongs to the shadcn CLI: source rules and Biome lint, formatting and fixes skip it by default. Neighbouring authored folders stay checked. This leaves TypeScript’s inputs unchanged, so type checking still covers the stock components.

Module folders under `src/modules/<name>` use the same `client/` and `server/` import boundaries as the foundation, and their shared declarations remain independent of both runtimes.

Naming rules treat numbered migration files such as `src/server/migrations/0001_create_notes.ts` as tool-owned, including in nested apps and in module folders such as `src/modules/notes/server/migrations`. The file must sit directly in its migration folder and match `NNNN_snake_case.ts`: four digits, an underscore and a lowercase name starting with a letter. Files elsewhere, files with other names and subfolders remain checked. The Biome preset lets `.ts` files directly in that folder whose names start with four digits and an underscore default-export their migration Effect, because Effect's migration loader imports the default export; Biome globs cannot spell the rest of the pattern, so the naming rules still report a malformed name.

Naming rules recognise Xcode's `*.xcodeproj` and `*.xcworkspace` bundles and their `Contents.json`, project containers and matching app folders, localised `*.lproj` folders, and `*.xcassets` catalogs with their asset sets, metadata and images.

Swift Package Manager packages containing `Package.swift` retain their package folder name and `Sources/<Target>` layout.

Android source sets with a sibling or own `AndroidManifest.xml` retain their native source set names and `res/` resource directories, including qualifiers such as `mipmap-hdpi` and `values-night`, with lower_snake_case resource files.

These contexts work at any repository path without configuration; TypeScript and JavaScript, deeper app source folders and ordinary assets outside native resource contexts remain checked, including within `ios/` and `android/`.

`defineConfig` checks the config's types. The CLI also validates it: a broken config, unknown rule id or invalid options fails before checks run. An explicit `--config` path must exist.

### 2. When architecture needs it: describe an import boundary

An app says where its code runs through folder names. A package adopts the runtime convention by having `src/client/` or `src/server/`; no config entry is needed. In that package, `src/client/` is browser code, `src/server/` is server code, and everything else is shared except package-root tooling. Keep shared code wherever its topic belongs; there is no required `src/shared/` folder or runtime file suffix.

`imports/runtime` rejects client imports of server code or Node built-ins. Shared code may import neither client nor server code, use browser globals such as `window`, `document` or `localStorage`, or import Node built-ins. Both client and server code may import shared code. The check includes type imports and re-exports and resolves aliases through the shared import graph. Locally bound names and property names are not browser globals; portable web APIs such as `URL`, `fetch` and `AbortController` remain available to shared code. Test files and `test-support/` ship nowhere and are outside this runtime policy.

A package whose code all runs in one runtime declares it in its manifest instead of nesting everything in one folder: `"quality": { "runtime": "server" }` makes every source file server code, and `"client"` makes every file browser code. Package-root tooling stays server code. A declaration beside `src/client/` or `src/server/` is reported on the manifest, as is any value other than `"client"` or `"server"`; choose one convention per package.

A package with a nonempty `bin` entry and no runtime folders is server code throughout. Runtime folders take precedence when a package also ships browser code. A Node library without a CLI declares `"runtime": "server"` or uses `src/server/`; `engines.node` alone does not say that a package is Node-only. A package with no runtime folders, runtime declaration or `bin` entry has no runtime policy beyond its tooling. Explicit fences run in every package. Runtime folders are detected independently of `sources`, including empty folders; `sources` still selects the code that is checked.

Tooling is server code in every package, including the workspace root: files under its top-level `script/`, `scripts/` and `tooling/` folders, and top-level JavaScript or TypeScript config files such as `vitest.config.ts`. A tooling folder or config file nested under `src/` follows the source runtime policy. Browser and shared code cannot import package-root tooling.

The manifest owns ordinary workspace dependencies. An **application** is a package whose manifest depends on `@shivaedev/platform`, the dependency shell that brings every runtime piece of the ShivaeDev framework. It imports each piece by its own name without listing it: `imports/manifest` and the `biome` rule's undeclared-dependency check count an import as declared when an entry point the application declares lists the piece among its dependencies. `@shivaedev/platform` is the entry point for any code and `@shivaedev/test-story` for test code, tooling and test support only. When a private package's import would be covered by an entry point it lacks, the finding names the entry point to add. `manifests/application` asks an application for `publicHoistPattern: ["@shivaedev/*"]` in the nearest `pnpm-workspace.yaml`, searching upward from the package, because pnpm does not link the pieces where the application can resolve them otherwise. It also rejects a dependency entry beside the entry point that already brings it, such as `@shivaedev/sql` beside `@shivaedev/platform`, and names the entry to remove. A library never depends on platform, so it declares every piece it imports.

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

This is `packages/ui/quality.fences.config.ts`; paths remain relative to the repository root. Fences supplied through `rules["imports/fences"].options.fences` join the same policy. This adds a fact about the repository's architecture to the shared import check. It does not select a different set of Quality rules. Use real checked files and workspace package names in these chains. The illegal chain must cross this fence alone; the legal chain must cross none. `mayNotImport` checks direct imports; `mayNotReach` also follows repository imports transitively; `mayImportOnly(...subjects).of(unit)` permits only named modules or folders of a unit. Fences count type imports but never hold test files or files under `test-support/`. The default `imports/no-test-code` rule rejects production imports of either, including type imports and re-exports. Move shared code into a production module that tests can import.

The import rules resolve every literal specifier the way the TypeScript compiler does, with the nearest `tsconfig.json`, and stop the run when the sources hold no module at all. A relative or `#` import of a file that a generator writes before the tests run resolves only inside a folder that `imports/resolvable` lists as `generated`; the folder, or every file an import names in it, must be ignored by git:

```ts
import { defineConfig } from "@shivaedev/quality/config.ts";

export default defineConfig({
	rules: { "imports/resolvable": { options: { generated: ["packages/db/src/test-support/generated"] } } },
});
```

### Story tests

Keep story kits and fixtures in `src/test-support` and keep each spec specific to its story. [`@shivaedev/test-story`](https://github.com/ShivaeDev/platform/tree/main/packages/test-story#readme) explains how to build the kit, traits and verbs over a real engine.

Quality's `tests/story-specs` rule reports a test file that declares tests without a kit's `it`, including plain Vitest `it` and `test` declarations mixed with stories. Typecheck tests are exempt, as are test-story itself and its transitive workspace dependencies, including development, optional and peer dependencies: requiring those packages to depend on test-story would create a cycle.

Quality's `tests/story-engine` rule reports a kit story with no traits whose body never references its verbs, its story or its test context. Drive the engine through one of the kit's verbs or traits, or, if the code under test is pure, move it to `<stem>.unit.test.ts`, which reaches no engine and mocks nothing. The rule follows the same kit origins and prerequisite exemptions as `tests/story-specs`; unit and typecheck files are exempt.

There is one other honest form. A pure function with no engine behind it gets a plain test in a **unit test** file, declared by the `unit` modifier: `parse.unit.test.ts` beside `parse.ts`, or `<behaviour>.unit.spec.ts`. A unit test exercises one unit and reaches nothing bigger, so `tests/story-specs` rejects a `.unit` file that reaches an engine, directly or through what it imports, following runtime imports through the shared import graph; type-only imports do not count. The engines are Node's file, network, process and worker modules, database clients, HTTP and socket libraries, DOM libraries and the story runners. A test-support fixture the unit file imports must pass the same check. The rule also rejects mocking (`vi.mock`, `vi.spyOn`, `vi.fn`, env and global stubs, fake timers), providing services (`Effect.provide*`, `Layer`, `ManagedRuntime`, `it.layer`) and DOM use in the unit file and its test-support fixtures. Running an Effect that needs nothing, such as with `Effect.runSync` or `it.effect`, is fine. When the module under test reaches an engine, the finding names the import chain and asks you to split the module: move the pure code into a module that reaches no engine and test that one. The static check reads imports and syntax. The runtime guard in `testProjects` catches I/O hidden inside an external package or a global such as `fetch` when a unit test runs.

Every finding names both repairs: drive the engine through the package's story kit, or, when the code under test is pure, move the test to a `.unit` file. Never wrap a pure function in a story that ignores its kit.

Every package tests its real engine through its own story kit, so setup and actions share the package's domain vocabulary. To repair a finding, build the kit with `storyKit` from `@shivaedev/test-story/server/storyKit.ts` in `src/test-support`, import it in the spec and replace plain registrations with `kit.it(name, traits, body)`. The rule follows imports, aliases and conditional registrars back to the kit; it checks declarations, while review and runtime tests establish whether the kit exercises the real engine.

Quality's `tests/story-setup` rule reports top-level test functions named with the words `seed`, `make`, `build` or `setup`, and fixture-writing calls imported from Node's `fs` or `fs/promises`. It leaves source and `test-support/` files alone. This is a check for those syntax patterns; a passing test file still needs review of what it tests.

Specs keep expectations visible. `tests/spec-helpers` moves all module-level helper functions out of specs and into the kit; `tests/no-expect-in-support` moves `expect` calls into the spec, except in test-support files that register tests at module top level and are not imported by any module, so nested Vitest runs can execute them as test files with real assertions. `tests/named-values` rejects numeric literals passed to `toBe` or `toHaveLength` in specs, except zero and process exit codes asserted on an `exitCode` subject: assert the observed items or use a domain name that comes from the story's inputs or the product. For HTTP statuses, import `* as HttpStatus` from `effect/http/HttpStatus` and use `HttpStatus.fromLiteral("NotFound")`; subjects named `status` or `code` do not exempt numeric assertions. A spec-local numeric const that only feeds these matchers is reported, including aliases for zero and codes. `tests/no-limit-imports` rejects importing `MAX_*` constants from a `limits` module into specs, so a story proves behavior instead of copying an implementation cap.

`boundaries/queue-sql` rejects SQL mentioning the private `pgboss.` schema. Apps use their queue definitions and let workers process jobs; there is no queue-purge API by design. `boundaries/auth-sql` rejects SQL accessing Better Auth's `user`, `account`, `session` and `verification` tables. Apps use platform's auth API; `options.owners` names platform's own auth implementation and its migrations. These rules inspect SQL templates, literal query calls and query variables, and inventoried `.sql` files. They do not evaluate arbitrary runtime SQL construction.

`boundaries/http-status` rejects comparisons with HTTP error status numbers, switch cases and literal status-list membership outside `options.edge`. Domain code handles typed errors; the named HTTP edge translates them into transport responses. Process exit codes remain ordinary domain values.

Declare these architectural facts in the repository's quality config; paths and patterns are relative to that config's directory:

```ts
export default defineConfig({
	rules: {
		"boundaries/auth-sql": { options: { owners: ["platform/auth/**", "platform/auth-migrations/**"] } },
		"boundaries/http-status": { options: { edge: ["src/http/**"] } },
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

Keep the default error level. The command replaces that rule's entries and leaves other rules' entries alone. Call out any new or raised count in the review and the pull request description. The [debt and hook guide](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/debt-and-hooks.md) covers the baseline format, exception subjects, limit changes, renames and commit checks.

### Baseline merges

Register the driver in `.gitattributes`:

```gitattributes
/quality-baseline.jsonl merge=quality-baseline
/packages/*/quality-baseline.jsonl merge=quality-baseline
```

Run `quality baseline install-driver` from your checkout's setup script. It sets only repository-local `merge.quality-baseline.driver`; it leaves other Git settings alone. Each checkout needs the setting because Git does not copy local configuration when cloning.

Git calls `quality baseline merge <ancestor> <current> <other>`. Entries are keyed by path and rule. Removing an ancestor entry on either side removes it from the result; retained counts take the minimum of the two sides, and entries newly added on either side survive. The command writes the result to `<current>`, so parallel reductions of neighbouring entries merge without a text conflict.

### Unused code

`code/unused` uses knip to report unused files, value and type exports, unused dependencies (including development and optional peer dependencies), and imports missing from the package manifest in every workspace. It runs through `quality lint` and the normal report and baseline. The rule accepts no options or permanent exceptions; Quality supplies knip’s entry points without a repository knip config. Runtime modules supplied by a host can be declared in an ambient script included by the importing file’s TypeScript project. These declarations satisfy the missing-dependency check only in that project; undeclared imports still fail.

Package `exports` are public API, including wildcard targets and source conditions. Package `bin` and scripts, test and story globs, tool configs and `src/test-support` provide the other entry points. Imports reachable from those entries count as used. Source-conditioned package import aliases resolve to their sources before a build. Compiler mappings from `tsconfig.json` and `tsconfig.build.json` keep imports on their source files when build output exists. An internal module can be used while one of its exports remains unused. An application’s declared dependency entry points satisfy provided imports under the same policy as `imports/manifest`.

For adoption, run `quality baseline write --rule code/unused` and review the recorded debt. Burn it down by deleting unused code, removing unused dependency declarations, declaring missing dependencies, or connecting code to a real entry point. Run `quality baseline tighten` after repairs, or `quality baseline prune` across the repository. Do not add an entry point just to hide dead code.

### What the rules check

`quality lint` prints each failing rule's guidance with its findings, so the finding is the reference for what to change. The built-in rules fall into these groups:
- **Structure:** `structure/max-lines` allows 150 lines in a source file and 300 in test code, `nesting/max-depth` rejects lines indented eight tabs deep, and `structure/no-barrel` rejects `index` modules. The preset rejects every re-export, types included; when `noExportedImports` suggests `export … from`, import the name where it is used instead. A module does one job.
- **Comments:** the `comments/*` rules reject JSDoc, TODOs, banners, line and pull request references, environment pragmas and more than two comments per file. A comment says why, never what the code already says or what it used to be. A tool pragma such as `@jsxImportSource` counts as a comment until both `comments/no-jsdoc` and `comments/max-per-file` list its tag in their `allow` option.
- **Documentation:** `docs/references` checks every Markdown file in the sources except `CHANGELOG.md`, whose released history keeps the links of its release. Relative links, reference definitions and `href`/`src` attributes reach an existing file or folder inside the repository, and a heading anchor matches one GitHub forms from the target's headings. A link to the repository's own GitHub tree, named by the root `package.json` `repository` field, is checked like a relative one unless it is pinned to a commit or a release tag. A published workspace package's README is shown on npm without the repository around it, so its links that leave the package use absolute URLs. Imports in TypeScript and JavaScript code blocks, workspace module paths such as `@scope/lib/repository.ts` written as inline code, `` `name` from `module` `` phrases and a package README's API rows resolve through the owning package's `exports` to a module that is not blocked, and every named import exists in that module unless it re-exports another. A linked document such as `CLAUDE.md` beside `AGENTS.md` is checked once, through its target. `docs/unversioned-installs` rejects a version after a package name in install commands, in shell code blocks and inline code; the package's own version ranges decide what installs, and a written version goes stale with the next release. A dist-tag such as `latest` passes.
- **Suppressions:** the `suppressions/*` rules reject inline lint and compiler directives, casts through `unknown`, `any` or `never`, Biome settings that weaken a check, recommended Biome rules the preset leaves below `error`, and `ignoreDeprecations`. None of them takes exceptions. A type test (`*.typecheck.test.ts`) may use `@ts-expect-error`; a test that must pass a rejected value at run time calls the API through `Reflect.apply`.
- **Imports:** cycles, unresolvable imports, workspace imports missing from the manifest or an entry point, relative imports that leave their folder, production imports of test code, runtime folders and fences, as described above.
- **Names and files:** the Biome preset's naming rules and plugins, and the `files/*` rules, which name a file after its main export with its folders as the prefix. No naming rule renames anything; the author picks the name. A name an outside system owns, such as a query parameter or an environment variable, is written as a quoted key, which the naming rules skip. A `Schema.Struct` field stays camelCase even when quoted and maps to the outside name with `Schema.encodeKeys`. Biome's naming messages print only a pattern: spell acronyms as words (`HttpClient`, `userId`, `parseUrl`) rather than turning off `strictCase` as its hint suggests, give a type no `I` prefix, and name a type parameter `T`, `T` plus a PascalCase name (`TItem`), or Effect's `A`, `E` and `R`. No rule checks these, so review does: a boolean reads as a question (`isOpen`, `canRetry`) unless the DOM or React names it (`open`, `disabled`); a schema shares its name with its type (`type Item = typeof Item.Type`); an unused parameter is removed rather than renamed with the `_` prefix TypeScript accepts. The naming rules take repository facts: `toolOwned` lists `.gitignore` patterns whose names a tool fixes, and a configured list extends the rule's defaults, so list only repository-specific additions; `content` lists snake_case content folders and files; `tests/follow` and `tests/colocated` take `suites` for test folders with their own layout, such as a Playwright suite.
- **React:** `react/jsx-conditionals` reports `&&` and ternaries in JSX children, including nested decisions. Decide before the JSX or extract a component that receives the data and returns `null` when it has nothing to show. Inside `.map`, extract an item component that makes its own decision. Conditional attributes such as `className` are accepted. This rule owns the check, so the shared Biome preset leaves `noLeakedRender` off.
- **Tests:** `tests/follow` and `tests/colocated` keep a test beside the code it covers, named `<file>[.<modifier>].test.ts` or `<behaviour>[.<modifier>].spec.ts` with at most one modifier of `dom`, `slow`, `typecheck` and `unit`; a unit test runs without the DOM, so `.unit.dom` is rejected. `tests/colocated` always treats `__tests__/` as a test folder. It treats `test/`, `tests/` and `spec/` as test folders only when their directly contained checked files are all tests or test support; a product folder with source beside its specs is an ordinary source folder. Declared `suites` keep their own layout. Shared test support belongs in `test-support/`, the sanctioned test-only folder. A test covering a whole module may sit at its root or directly beside its folder. The story rules above keep setup in the kit.
- **Manifests:** `manifests/sorted` keeps every `package.json` in sort-package-json order, and `manifests/source-first` puts the `source` condition first in `exports` and `imports`. `manifests/exports-shape` checks the package root and workspace members with exports. They use one file-preserving TypeScript wildcard: for example, `./*.ts` maps to `./src/*.ts`, `./dist/*.d.ts` and `./dist/*.js` under `source`, `types` and `default`. A subtree pattern such as `./server/*.ts` keeps that same subtree in its targets. An optional root entry, exact-path non-code assets such as JSON presets, `./package.json` and `null` blocks are allowed. A package without modules, such as a dependency shell, exports only exact assets and needs no wildcard. Import each module at its path under `src/`; named aliases, flattened paths, per-file module lists and additional non-null wildcards fail. `manifests/application` keeps an application on its entry points, as described above.
- **Biome:** the `biome` rule reports Biome's error findings as `biome/<category>`. A Biome run that fails without an error finding, such as one whose config leaves no file to check, fails lint and fix with Biome's message. The preset leaves out the `.worktrees` folder at the root, so a checkout does not lint its linked worktrees, while a worktree inside it lints all of its own files. The preset's plugins ban ambient time, randomness, `console` and `process.env` in favour of Effect's services.

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

### API

Import names from their defining module; there is no root entry. The package's `./*.ts` export pattern also exposes the gate's implementation modules; the following table lists the config, tool and extension entry points:

| Module                        | Exports                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `config.ts`                   | `defineConfig`, `QualityConfig`, `Level` (`"error"`), `RuleSetting`, `RuleSettings`, `BuiltInRules`  |
| `rule.ts`                     | `defineRule`, `Rule`, `Configured`, `Finding`, `Findings`, `SourceFile`, `RuleInputs`, `RuleContext` |
| `standardSchema.ts`           | `StandardSchemaV1`, `StandardResult`, `StandardIssue`, `describeIssue`                               |
| `imports/fence.ts`            | `fence`                                                                                              |
| `imports/fences/selectors.ts` | `packages`, `folders`, `files`, `modules`, `scopes`, `anyOf`, `workspace`, `anything`, `external`    |
| `imports/fences/model.ts`     | `Fence`, `Target`, `Selector`, `Prohibition`, `Examples`, `Chain`, `ExampleStep`, `External`         |
| `testProjects.ts`             | `testProjects`, `TestProjectsOptions`                                                                |
| `appViteConfig.ts`            | `appViteConfig`                                                                                      |
| `appTestConfig.ts`            | `appTestConfig`                                                                                      |
| `naming/testName.ts`          | `testName`, `isTestCode`, `isTestSupport`, `ENVIRONMENTS`, `Environment`, `TestName`                 |

#### Config

| Key          | Default                                                      | Meaning                                                                                                               |
| ------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `sources`    | `["."]`                                                      | Directories or files the source rules check, relative to the repository root.                                         |
| `extensions` | `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs` | Source extensions.                                                                                                    |
| `baseline`   | `quality-baseline.jsonl`                                     | Root shard for paths outside packages; package shards use `packages/<package>/quality-baseline.jsonl`.                |
| `exceptions` | `[]`                                                         | Permanent exceptions as `{ files, rules, reason, subject? }`.                                                         |
| `registry`   | `quality/registry.json`                                      | Legacy input for upgrades; run `quality exceptions migrate`.                                                          |
| `local`      | `[]`                                                         | Exposed extension API for rules made with `defineRule`; not required for adoption.                                    |
| `rules`      | Every rule at `error`                                        | Options by rule id, such as import boundaries. An explicit `error` or `{ level: "error", options }` is also accepted. |

#### Local rules

The exposed local-rule API supplements the gate; a repository does not need to use it to get the shared policy. Reusable quality policy belongs in Quality itself.

```ts
import { defineRule } from "@shivaedev/quality/rule.ts";

export const noLog = defineRule({
	check: ({ sources }) =>
		sources.filter((file) => file.text.includes("console.log")).map((file) => ({ file: file.path, message: "logs to the console." })),
	description: "Log through the logger.",
	id: "local/no-console-log",
});
```

Register it with `defineConfig({ local: [noLog] })`. Its check receives `root`, checked paths in `files`, source files in `sources`, `readText(path)` and decoded `options`, and may return findings directly or asynchronously. For options, provide a [Standard Schema](https://standardschema.dev) validator; an absent options object is validated as `{}`, so defaults belong in the schema, and a rule without a schema refuses options. A finding's optional `subject` distinguishes exceptions within a rule and file. A limit rule reports its amount over the limit as `count` and the limit as `threshold`; the baseline stores the count. Set `registrable: false` when a rule must never be excused by a config exception.

#### Command line

```text
quality lint [--config <file>]
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

Node 24 or later is required. The CLI loads the TypeScript config through Node's native import; use erasable syntax and `.ts` extensions for relative TypeScript imports.

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

Platform apps can share the Vite and Vitest setup too:

```ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { appViteConfig } from "@shivaedev/quality/appViteConfig.ts";

export default appViteConfig([tailwindcss(), react()]);
```

Use this in `vite.config.ts`. Plugins belong to the app. The shared server proxies `/api/auth` and `/rpc` to the local host on port 3000, preserving the request Host. It enables TypeScript path resolution. Client routes, including administration pages, stay on Vite.

```ts
import { appTestConfig } from "@shivaedev/quality/appTestConfig.ts";

export default appTestConfig();
```

Use this in `vitest.config.ts`. It composes `testProjects` with browser and server resolution and inlines the `@shivaedev` packages for the test server, since an application imports each framework piece by its own name. Both helpers accept extra export conditions for workspace development: `appViteConfig(plugins, ["source"])` and `appTestConfig(["source"])`. Published apps use the defaults.

For Vitest, install `vitest`, and add `@shivaedev/test-story` and `happy-dom` when the repository has DOM tests, then use:

```ts
import { testProjects } from "@shivaedev/quality/testProjects.ts";
import { defineConfig } from "vitest/config";

export default defineConfig({ test: testProjects() });
```

`testProjects` selects three projects by default: `unit` runs ordinary Node tests and specs, `pure` runs `.unit.test` and `.unit.spec` files in Node, and `dom` runs `.dom` tests and specs in test-story's DOM environment. The `pure` project always installs an I/O guard: calls to Node's `fs` (including `fs/promises`), `net`, `http`, `https`, `child_process` and `worker_threads` modules and global `fetch` throw an error naming the unit file and call. The guard also patches ESM named imports while preserving Node and Vitest module loading. Keep unit tests pure; test I/O through the package's story kit. Use `--project pure` to run only unit files, or `--project unit` for ordinary Node files. The DOM environment keeps Node's host constructors separate from the happy-dom window, so DOM specs need no project remap. Each test gets 30 seconds instead of Vitest's 5, because tests that start servers, browsers or CLIs take seconds on a busy CI runner. `.slow` tests run only when `--project slow` asks for them. Type tests are excluded from Vitest and belong in the compiler's input. Every project excludes `**/.worktrees/**` so a checkout does not collect specs from its worktrees.

Worker concurrency comes from a configured PostgreSQL connection budget, independent of CPU count: `max(1, floor(connectionBudget / connectionsPerWorker))`. The defaults are 80 usable connections and 14 connections per worker, giving five workers. The budget leaves room on a typical 100-connection server for administration and other clients; the estimate allows for full-app tests with several pools. Set the budget from your server's `SHOW max_connections`, subtracting connections reserved for other clients and concurrent test processes. Quality does not query the server. If even one worker exceeds the budget, it still runs one worker; reduce that test's pool sizes or increase the server capacity.

Set the per-worker estimate to the peak connections held by one test worker, and supply your usable budget or an explicit worker override:

```ts
testProjects({ connectionBudget: 84, connectionsPerWorker: 14 });
testProjects({ maxWorkers: 4 });
```

The first configuration allows six workers, including on a two-CPU runner. `maxWorkers` takes precedence over the connection calculation. Counts and estimates must be positive safe integers. Vitest's native `--maxWorkers` CLI option can also override the returned configuration for a single run.

Coverage is opt-in: `testProjects({ coverage: true })` enables Vitest's V8 provider across the selected projects. Quality supplies `@vitest/coverage-v8` at its supported Vitest version. The report includes unvisited `src/**/*.ts` and `src/**/*.tsx` files and excludes declarations, tests, specs and `test-support`. To customize it, pass native Vitest coverage options, for example `testProjects({ coverage: { reporter: ["lcov", "text-summary"] } })` or `appTestConfig([], { coverage: { include: ["src/domain/**/*.ts"] } })`. No separate coverage config is needed.

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

The **PostgreSQL URL gate** is the only permitted skip convention: a test that needs real PostgreSQL registers conditionally on its `PLATFORM_*_TEST_DATABASE_URL`. Skip only when that URL is absent; with a URL, execute the body against PostgreSQL and let connection or setup failures fail the test. Nothing else may skip. Keep the condition next to the database setup, either in the test file or its shared `test-support` module:

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

Quality merges the Biome settings at lint and fix time; do not add or mirror an override in `biome.json`. Files are explicit repository paths. Biome exceptions cover individual lint rules or assist actions; whole checks, rule groups and globs are rejected. `biome/files/includes` is the directory exclusion form: keep `**` and list negative patterns naming directories, such as `!**/test-support/generated`. Quality's shipped exceptions are part of its internal policy. [Exceptions and upgrades](https://github.com/ShivaeDev/platform/blob/main/packages/quality/docs/debt-and-hooks.md#exceptions) describes subjects, stale entries and the upgrade command.
- The source inventory and Biome have their own scopes. `quality fix` runs Biome from the config's folder; it is not restricted to the source-rule inventory.
- The installed hook checks files on disk, not only what is staged, and uses each committing worktree's config and dependencies. Installation sets repository-local `core.hooksPath`; the hook chains an executable global pre-commit hook without changing global configuration. Either hook's failure blocks the commit. `quality hooks status` reports when git's effective hooks path does not run Quality.
- Workspace imports require a declaration in the importing package’s `dependencies`, `peerDependencies` or `optionalDependencies`. Tests, `test-support`, package-root tooling folders (`script`, `scripts`, `tooling`) and package-root config files may also use `devDependencies`. Explicitly export-blocked bundle inputs may use them when no runtime module reaches those inputs in the scanned import graph; an executable or another public export keeps its imports in the runtime boundary.
