# @shivaedev/quality

One quality gate for a repository: typed rules, one report, a baseline of existing debt and a registry of permanent exceptions, each with its reason.

Every rule is an error by default. A repository adopts the gate at once: it records its existing violations in the baseline, and from then on a finding the baseline does not cover fails, and fixed debt leaves the baseline as files change. A baseline that grows shows in the diff, where a reviewer judges it.

## Setup

```sh
pnpm add --save-dev @shivaedev/quality
```

On pnpm 11, installing into a project needs a decision on `msgpackr-extract`, which `effect` pulls in: pnpm refuses its build script by default, and `pnpm add` fails with `ERR_PNPM_IGNORED_BUILDS`. Record the decision under `allowBuilds` in `pnpm-workspace.yaml`, or run `pnpm approve-builds`; `false` skips the build. `pnpm dlx` and `pnpm add --global` need no setting.

```yaml
allowBuilds:
  msgpackr-extract: false
```

Node 24 or later loads `quality.config.ts` directly (type stripping), so no build step runs first. Use only erasable TypeScript in the config, and give relative imports their `.ts` extension.

```ts
// quality.config.ts
import { defineConfig } from "@shivaedev/quality/config.ts";
import { noConsoleLog } from "./quality/no-console-log.ts";

export default defineConfig({
	sources: ["src", "scripts"],
	exclude: ["src/components/ui/", "*.gen.ts"],
	local: [noConsoleLog],
	rules: {
		"structure/max-lines": { options: { source: 200, testFiles: ["e2e/"] } },
		"comments/max-per-file": { options: { max: 3 } },
		"local/no-console-log": "warn",
	},
});
```

| Key | Default | Meaning |
| --- | --- | --- |
| `sources` | `["."]` | Directories or files to check, relative to the config. A missing source is an error. |
| `exclude` | `[]` | Paths never checked, in `.gitignore` syntax. Files ignored by git, `.git` and `node_modules` are always skipped. |
| `extensions` | TypeScript and JavaScript modules | Which files rules read as sources. |
| `registry` | `quality/registry.json` | Permanent exceptions. |
| `baseline` | `quality/baseline.jsonl` | Existing violations that the gate lets through. |
| `local` | `[]` | The repository's own rules, made with `defineRule`. |
| `rules` | every rule at `error` | A level per rule id, or `{ level, options }`. |

The config is typed: an unknown rule id, a misspelled option or an option of the wrong type fails to compile. It is also validated when loaded, so a JavaScript config gets the same checks.

## Levels

- `error` is the default. An error-level violation that the baseline and the registry do not cover fails the gate.
- `warn` reports without failing. It exists for the transition to a new rule and is meant to be temporary: move the rule to `error` and baseline what is left.
- `off` disables the rule.

## Rules

`structure/max-lines` keeps each module to one job: a source file may have 150 lines and [test code](#test-code) 300, counted the way an editor numbers them. Declaration files are exempt. Its options are `source` and `test` (the limits) and `testFiles`, `.gitignore` patterns of further folders whose files count as tests, such as a Playwright suite in `e2e/` (none by default). A file over its limit counts one violation for each line above it: 168 lines under a limit of 150 count 18.

### Comments

A comment says why, never what the code already says or what it used to be. Seven rules hold every comment to that:

| Rule | Reports | Options |
| --- | --- | --- |
| `comments/no-jsdoc` | Every `/** */` block, except a tool pragma the config allows | `allow` |
| `comments/no-line-reference` | A line number: `file.ts:42`, `file.ts#L42`, `line 42` | none |
| `comments/no-pr-reference` | A pull request or issue: `#123`, `PR 123`, `MR 123`, `pull request 123`, `merge request 123`, `issue 123`, `ticket 123`, `/pull/123`, `/pulls/123`, `/issues/123`, `/merge_requests/123`, `GH-123` | none |
| `comments/no-banner` | A banner, divider or region: a line that starts or ends with three or more of `- = * # ~ _ + / \ ─ ━ ═ ┄ ┈`, `#region`, `#endregion` | none |
| `comments/no-todo` | `TODO`, `FIXME`, `XXX` and `@todo` | none |
| `comments/no-environment-pragma` | A test environment set by a `@vitest-environment` or `@jest-environment` pragma (and its `-options`); name the file `*.dom.test.ts` instead, see [Vitest projects](#vitest-projects) | none |
| `comments/max-per-file` | A file with more than `max` comments, 2 by default | `max`, `allow` |

The rules find comments with the TypeScript parser, so text inside strings, template literals, regular expressions and JSX never counts as a comment. They read the TypeScript and JavaScript modules among the sources and skip declaration files and the directives listed below. Each finding names the line its comment starts on.

The default is no comments at all: a comment states only what the code cannot show, such as a constraint or a reason, and never narrates the code. The limit of `comments/max-per-file` is a crude tripwire against runaway comments, not a budget to fill, so a file that reaches it means something went wrong.

`comments/max-per-file` counts comments this way:

- A block comment counts once, however many lines it spans.
- Line comments that each stand alone on adjacent lines form one run and count once. A blank line, code, a directive, or a comment after code on the same line starts a new one.
- Allowed tool pragmas and directives are not counted: compiler and linter directives (`@ts-…`, triple-slash directives such as `/// <reference …>`, `biome-ignore…`, `eslint-disable…`, `eslint-enable…`, `oxlint-…`, `stylelint-…`, `deno-lint-ignore…`, `tslint:disable…`, `prettier-ignore`, Flow's `$FlowFixMe`, `$FlowIgnore`, `$FlowExpectedError`, `$FlowIssue` and `@noflow`), bundler annotations (`#__PURE__`, `@__PURE__`, `#__NO_SIDE_EFFECTS__`, `@__NO_SIDE_EFFECTS__`) and coverage hints (`c8 ignore`, `v8 ignore`, `istanbul ignore`). The suppression rules below report the directives that silence a check.

A file over the limit counts one violation for each comment above it: 5 comments against a limit of 2 count 3. A finding names the first comment over the limit.

A tool pragma is a comment whose every line starts with an allowed tag, such as `/** @jsxImportSource preact */`. `allow` lists the tags and is empty by default, so a pragma counts as a comment until the config allows its tag. Settings that a pragma would repeat in each file belong in the tool's config. `comments/no-jsdoc` and `comments/max-per-file` each take their own list, so give both the same one:

```ts
const pragmas = ["@jsxImportSource", "@license"];

export default defineConfig({
	rules: {
		"comments/no-jsdoc": { options: { allow: pragmas } },
		"comments/max-per-file": { options: { allow: pragmas } },
	},
});
```

A repository with existing comments adopts the rules through the baseline, for example `quality baseline write --rule comments/no-jsdoc --rule comments/max-per-file`.

### Suppressions

A check that is silenced at one site hides the problem instead of fixing it. Five rules close the escape hatches, and none of them takes registry exceptions: a registry entry that names one fails the gate as stale. A repository with existing suppressions adopts the rules through the baseline.

| Rule | Reports | Options |
| --- | --- | --- |
| `suppressions/no-inline` | Every comment directive that silences a linter, the compiler or a formatter, except `@ts-expect-error` in a type test | none |
| `suppressions/no-double-cast` | A cast through `unknown`, `any` or `never`: `x as unknown as T`, `x as any as T`, `x as never as T`, `<T><unknown>x` | none |
| `suppressions/biome-overrides` | A Biome setting that turns a check off or down, or keeps files out of it, without a declaration, and a declaration that matches no setting | `declared` |
| `suppressions/biome-recommended` | A rule the installed Biome recommends that the [Biome preset](#biome-preset) neither sets to `error` nor declares | none |
| `suppressions/no-ignore-deprecations` | `compilerOptions.ignoreDeprecations` in a tsconfig, which silences TypeScript's errors for deprecated options | none |

`suppressions/no-inline` reports these directives, wherever a line of a comment starts with one:

- Biome: `biome-ignore`, `biome-ignore-all` and `biome-ignore-start`, for lint, assist and format alike. The `biome-ignore-end` that closes a range is not reported again.
- TypeScript: `@ts-ignore`, `@ts-expect-error` and `@ts-nocheck`. `@ts-check` turns checking on and is allowed.
- Other linters: `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line` and inline rule settings such as `/* eslint no-console: "off" */`; the same `-disable` forms of `oxlint` and `stylelint`; `deno-lint-ignore` and `deno-lint-ignore-file`; `tslint:disable…`.
- Formatters: `prettier-ignore`, since `prettier --check` fails on the code it skips.
- Flow: `$FlowFixMe`, `$FlowIgnore`, `$FlowExpectedError`, `$FlowIssue` and `@noflow`.

Coverage hints (`c8 ignore`, `v8 ignore`, `istanbul ignore`) are allowed: they leave code out of a coverage measure and silence no linter or compiler. The rule reads the TypeScript and JavaScript modules among the sources, declaration files included, and every `.css`, `.scss` and `.less` file among the checked files, whatever `extensions` says. Each finding names the line its comment starts on and has the directive as its subject.

`suppressions/no-ignore-deprecations` reads every JSON file in the repository whose `compilerOptions` sets `ignoreDeprecations`, whatever the file is named, so a shared config such as `tsconfig/base.json` counts as much as a `tsconfig.json`. Like `manifests/sorted`, it walks the whole repository, not only the sources, and skips files ignored by git and `node_modules`. Each finding names the line of the setting. Replace the deprecated option it hides, then remove it.

#### Type tests

A type test proves that an API rejects what its types forbid, and TypeScript asserts a compile error only through `@ts-expect-error`, which fails as soon as the error it expects goes away. So `@ts-expect-error`, and no other directive, is allowed in a type test: a file named `*.typecheck.test.ts`, `*.typecheck.spec.ts` or `typecheck.test.ts` (or `.tsx`). The compiler checks these files; [Vitest projects](#vitest-projects) never run them. `@ts-ignore`, `@ts-nocheck` and every linter and formatter directive stay reported in them. A test that must pass a rejected value at run time, to prove the runtime refuses it too, calls the API through `Reflect.apply` instead of a directive.

`suppressions/no-double-cast` finds casts with the TypeScript parser, through parentheses and in either assertion syntax. A single cast is left to the linter, and `as const` is not a cast.

#### Declared Biome overrides

A scope that truly cannot follow a lint rule keeps its exception in the Biome config, and the quality config declares it with a reason. `suppressions/biome-overrides` reads `biome.json` or `biome.jsonc` at the root, every nested `biome.json` and `biome.jsonc` among the checked files, and the configs each of them `extends`, resolved the way Biome resolves them (see [Shared presets](#shared-presets)). These settings count as overrides, at the top level and in every `overrides` entry:

| Setting | Declared as |
| --- | --- |
| A lint rule at `off`, `warn` or `info`, as a string or a `level` | `lint/<group>/<rule>` |
| A lint group at `off`, `warn` or `info`, or with `recommended: false` or `preset: "none"` | `lint/<group>` |
| `linter.rules` with `recommended: false` or `preset: "none"` | `lint/recommended` |
| A domain at `none` | `lint/domains/<domain>` |
| `linter.enabled: false` | `lint` |
| An assist action at `off`, such as `useSortedKeys` or `organizeImports` | `assist/<group>/<action>` |
| `assist.actions` with `recommended: false` or `preset: "none"` | `assist/recommended` |
| `assist.enabled: false` | `assist` |
| `formatter.enabled: false` | `format` |
| `enabled: false` in a language's `linter`, `assist` or `formatter`, such as `css.linter` | `<language>/lint`, `<language>/assist`, `<language>/format` |
| An `includes` list in `files`, `linter`, `assist` or `formatter` that excludes a pattern with `!` or lacks `**` | `files/includes`, `lint/includes`, `assist/includes`, `format/includes` |

Biome runs assist actions, key sorting among them, as part of `biome check` and reports what they would change, so turning one off is an override. Formatter options such as `indentStyle` or `lineWidth` choose a style, not an exception, and are not overrides. Settings that raise a rule or enable it are not overrides either. Rule options are not read, so an option that loosens a rule, such as a higher complexity limit, is left to review.

```ts
export default defineConfig({
	rules: {
		"suppressions/biome-overrides": {
			options: {
				declared: [
					{
						rule: "lint/style/noDefaultExport",
						includes: ["*.config.ts"],
						reason: "Tools load their config files through the default export.",
					},
					{
						rule: "lint/suspicious/noConsole",
						includes: ["scripts/**"],
						reason: "Scripts report to the terminal they run in.",
					},
				],
			},
		},
	},
});
```

A declaration covers a setting when its `rule` and its `includes` match the setting's exactly, in any order. An `includes` list that keeps files out is declared as the whole list, so every pattern added to it needs the declaration to change too. A setting at the top level of the root config has the scope `["**"]`, and an `overrides` entry has its own `includes` (`["**"]` when it has none). Patterns in a nested config are relative to its folder, so they are declared with the folder in front: `"src/**"` in `packages/web/biome.json` is declared as `"packages/web/src/**"`, and its top level as `"packages/web/**"`. A setting without a declaration is reported at its line in the Biome config; a declaration that no setting matches is reported against the root config, so the list cannot outlive the overrides it explains.

#### Shared presets

A config `extends` its entries the way Biome does:

- An entry that starts with `./` or `../` is a file next to the config. Any other entry is first a file at the repository root, then a package in the root's `node_modules`, resolved through its `exports` (with the `biome` and `default` conditions, and `*` patterns), then its `main`, then a file inside it. A package may also name itself through the repository's own `package.json` `exports`. `"//"` in a nested config extends the root config, which is read on its own.
- Biome reads only the entries of the config it loads: the `extends` of an extended config are not followed, so they are not read here either.
- The extended configs apply from left to right and the config itself last. A later setting of a rule, a group, `recommended` or `enabled` replaces an earlier one, so a preset's weakening that the repository sets back to `error` is no override. A group set as a whole (`"suspicious": "error"`) replaces the settings of its rules; a rule set inside a group the preset turned off leaves the rest of the group off.
- Lists are appended, not replaced: `overrides`, `plugins` and every `includes` list, `files.includes` among them. A repository's `files.includes` adds to the preset's, so each list is declared by whoever wrote it.
- Patterns in an extended config resolve against the repository root, or against the folder of a nested config that extends it, as patterns in the config itself do.

A package that ships a preset declares the weakenings the preset makes in a `declarations.json` beside the preset file, as an array of the same `{ rule, includes, reason }` entries the `declared` option takes. Its `includes` are written relative to the repository that extends the preset. Those weakenings count as declared, so the repository adds nothing for them:

```json
[
	{
		"rule": "lint/style/noDefaultExport",
		"includes": ["**/*.config.ts"],
		"reason": "Tools load their config files through the default export."
	}
]
```

A weakening the preset makes without such a declaration is reported at the line of the repository's `extends` entry, and the repository's own declaration covers it. A weakening the repository adds beyond the preset needs its own declaration, and a repository declaration that repeats one the preset ships is reported until it is removed. A preset entry that cannot be resolved or read, or whose `declarations.json` is invalid, is reported at the `extends` entry as well.

#### Recommended Biome rules

`suppressions/biome-recommended` holds the [Biome preset](#biome-preset) to every rule Biome recommends, so a Biome upgrade that adds a recommended rule, or recommends one the preset leaves below `error`, fails the gate until the preset takes a position on it. It asks the installed Biome, the one `quality` runs, which rules its `recommended` preset enables, through `biome rage --linter`, so the list is never written down. When the root Biome config extends `@shivaedev/quality/biome`, it reads that preset and its `declarations.json`, resolved from the repository root as under [Shared presets](#shared-presets); a repository that does not extend the preset is left to the `biome` rule, which asks for it. A recommended rule is in order when the preset's `linter.rules` sets it to `error`, directly or through its group's severity, or when a declaration names it, whatever the declaration's `includes`. Every other recommended rule is reported at the preset, one finding per rule: set it to `error`, or declare why not.

### Imports

Four rules read the imports of the TypeScript and JavaScript modules among the sources. They build it once per run with the TypeScript compiler, without a bundler or another dependency.

| Rule | Reports | Options |
| --- | --- | --- |
| `imports/cycles` | Modules that import each other at run time | none |
| `imports/resolvable` | An import that resolves to nothing | `generated` |
| `imports/fences` | An import that crosses a fence the config declares | `fences` |
| `imports/aliased` | A relative import that leaves its own folder | none |

Each import resolves the way the compiler resolves it, with the options of the nearest `tsconfig.json` and the projects it references, under bundler resolution: `paths`, `package.json` `imports` and `exports` and the `source` condition hold, so a workspace package resolves to its source. The graph reads static and dynamic imports, `export ... from`, `require()`, `require.resolve()`, `import.meta.resolve()` of a bare specifier (a relative one is URL arithmetic that never checks the path), `import()` types, `/// <reference types>`, `/// <reference path>` and JSDoc `@import` tags.

- An import of a stylesheet, an image or JSON resolves to the file, and only when the file exists, whatever declaration describes it. A Node builtin resolves.
- A runtime import must resolve to code: a declaration file (`.d.ts`, `.d.mts`, `.d.cts`, or an asset declaration such as `.d.css.ts`) satisfies only `import type` and `export type`, however the import reaches it, so a package that has only its `@types` package installed, or an `exports` entry that points at a declaration, is reported.
- A bare import resolves when a declaration file of the importer's tsconfig project declares the module in a script (`declare module "virtual:*"`). A relative import always needs a real file, `declare module "*"` and patterns with more than one `*` never count, and a `declare module` inside a module is an augmentation, which declares nothing new.
- A relative import or a `#` package import of a missing file resolves only inside a folder that `generated` names, such as a client a generator writes before the tests run. A `#` import lands where its `imports` entry in `package.json` points once the file exists. Each folder must be ignored by git, or at least every file an import names in it must be, hold no file git tracks but a `.gitkeep` or `.keep` placeholder, lie outside `node_modules` and hold a file that an import names. The import stays an edge to its path, so fences apply to it before the file exists.
- A module that resolves into `node_modules` or outside the root is external, and its package is the one it resolves into, whatever alias the import uses. A `@types` package counts as the package it describes: `@types/hast` is `hast`, `@types/scope__name` is `@scope/name`.

```ts
"imports/resolvable": { options: { generated: ["packages/db/src/test-support/generated"] } },
```

`imports/cycles` reports each group of modules that import each other at run time once, at the alphabetically first of them, with one loop through the group. Its count is the number of modules in the group. `import type`, `export type`, type references and imports in declaration files are left out; `import { type X }` stays a runtime import. Dynamic `import()` and `require()` count; `require.resolve()` does not. It takes no registry exceptions. Each finding of `imports/resolvable` has the import as its subject.

The gate fails closed: when the sources hold no module at all, the imports rules stop the run instead of passing on an empty graph. Point `sources` at the code, or turn the rules off.

#### Aliases

A relative import names only a file in its own folder, such as `./format.ts`: the folder is one module. Every other import goes through an alias, so moving a file never rewrites a chain of `../`:

- the `imports` of the importer's nearest `package.json`, such as `"#lib/*": "./src/lib/*"`, or `"#shared/*": "@demo/shared/*"`, which names another workspace package;
- the name of another workspace package, as far as its `exports` reach.

An import that already goes through a tsconfig `paths` alias is not relative, so the rule leaves it alone.

`imports/aliased` reports a relative import that goes up (`../format.ts`) or down into a subfolder (`./parts/deeper.ts`, or `./widgets` for `widgets/index.ts`). It reads static imports, `export ... from`, side-effect imports, `import()`, `require()`, `import()` types, JSDoc `@import` tags and the paths of `vi.mock`, `vi.doMock`, `vi.unmock`, `vi.doUnmock`, `vi.importActual` and `vi.importMock`, so a mock keeps pointing at the module it replaces. An escaped path, such as `"\x2e\x2e/format.ts"`, counts as the path it spells. Each finding has the import as its subject. Its message names the fix for where the import lands:

- inside its own package: import through a `#` alias from the `imports` of the package's `package.json`, and declare one if none fits;
- inside another workspace package: import it by that package's name, through a path its `exports` lists;
- inside an installed package under `node_modules`: import that package by its name.

The rule only reports; nothing rewrites the import. Whoever writes the import picks the alias, because only they know which conditions their runtimes, bundler and tests use.

#### Fences

A fence is one prohibition, stated in the config without patterns:

```ts
import { defineConfig } from "@shivaedev/quality/config.ts";
import { external, folders, packages } from "@shivaedev/quality/imports/fences/selectors.ts";
import { fence } from "@shivaedev/quality/imports/fences/dsl.ts";

const fences = [
	fence("ui-never-imports-server")
		.because("The UI ships to browsers.")
		.from(folders("packages/ui/src"))
		.mayNotImport(packages("server"))
		.demonstratedBy({
			illegal: ["packages/ui/src/app.ts", "packages/server/src/db.ts"],
			legal: ["packages/ui/src/app.ts", external("effect")],
		}),
];

export default defineConfig({ rules: { "imports/fences": { options: { fences } } } });
```

A fence has a name, a reason, the modules it holds (`from`) and one prohibition:

- `mayNotImport(target)`: no module it holds imports the target.
- `mayNotReach(target)`: nothing a module it holds imports, directly or through other modules of the repository, is the target. The finding names the path.
- `mayImportOnly(...subjects).of(unit)`: the modules it holds import only the named modules or folders directly in a package's `src` folder (or the package folder) or in a folder.

Targets are `packages(...)` (workspace packages by name, with or without their scope; a workspace package is a named `package.json` that `pnpm-workspace.yaml` or the root `package.json` `workspaces` includes, with `*`, `**`, `?`, `{a,b}` and `[...]` in its patterns, none of which match a folder whose name starts with `.` unless the pattern spells the dot, and a `packages` list or pattern the gate cannot read stops the run, and it holds every file below it that no deeper workspace package holds), `folders(...)`, `files(...)`, `modules(...)` (external packages by package name, and Node builtins), `scopes(...)` (every external package of a scope), `anyOf(...)`, `workspace` (every workspace package) and `anything`. Each takes `.except(...)`.

The config does not compile without `demonstratedBy`, and the rule checks the examples against the policy: each is a chain of imports from a file of the repository, which may end in `external(name)`. The illegal example must cross this fence and no other; the legal example must cross none. Every name a fence uses must exist: a package, a folder that holds checked files, a checked file, a subject of the unit. Two fences may not share a name, and each needs a reason. A policy that breaks any of this stops the run. Fences count type imports too.

Fences guard shipped code, and [test code](#test-code) ships nowhere, so a fence never holds it: a test file or a file under `test-support/` may import across every fence. There is no option to check them.

A finding has its fence's name as its subject, so a registry entry with that subject excuses one file from one fence.

### Manifests

`manifests/sorted` keeps every `package.json` in the repository in the key order of [sort-package-json](https://github.com/keithamus/sort-package-json), a dependency of this package. It walks the whole repository, not only the sources, and skips files ignored by git and `node_modules`. A manifest that is not valid JSON is reported too. `quality fix` sorts the manifests, and the rule takes no registry exceptions.

### Local rules

```ts
import { defineRule } from "@shivaedev/quality/rule.ts";

export const noConsoleLog = defineRule({
	id: "local/no-console-log",
	description: "Log through the application logger.",
	check: ({ sources }) =>
		sources.flatMap((file) =>
			file.lines.flatMap((text, index) =>
				text.includes("console.log(") ? [{ file: file.path, line: index + 1, message: "Logs to the console." }] : [],
			),
		),
});
```

A rule that must never be excused, like the suppression rules, sets `registrable: false`; the registry then refuses entries for it.

`check` receives the repository `root`, every checked path in `files`, the `sources` with their `text` and `lines`, `readText(path)` for any other file (undefined when absent) and the validated `options`. It returns findings, or a promise of them. A finding names its `file`, relative to the root (an absolute path under it is made relative), and its `message`, and optionally a `line`, a `subject` that tells apart exceptions of one rule in one file, a `count` of the violations it stands for (1 by default) and the `threshold` it applied. A rule with a limit reports one finding per file, with the amount over the limit as its `count` and the limit as its `threshold`.

A rule with options declares them with any [Standard Schema](https://standardschema.dev), such as `Schema.toStandardSchemaV1(...)` from Effect. Options are an object: when the config gives none, the schema validates `{}`, so give each option a default or make it optional. A rule without an options schema refuses options.

## Baseline

```jsonl
{"path":"src/legacy/sync.ts","rule":"comments/no-jsdoc","count":3}
{"path":"src/server/db.ts","rule":"structure/max-lines","count":262}
```

The baseline is a JSON Lines file with one entry per line: the violations of one rule in one file. `count` is how many violations the file may have. For a rule that counts occurrences, such as `comments/no-jsdoc`, that is the number of occurrences. For a rule with a limit, it is the amount over the limit: the entry above lets `src/server/db.ts` have 412 lines under a limit of 150. Entries are sorted by path and then rule, and each tool that changes the file rewrites only the lines it changes, so a diff names exactly the entries that moved and two branches conflict only when they touch the same or neighbouring entries.

`quality lint` fails when a baselined file has more violations than its `count`; the report then lists all of that file's violations for the rule. A file at or below its entry passes. An entry that allows more than is left, including a file with no violations left, is listed as a note and does not fail, so fixing debt never breaks the build; `tighten` and `prune` lower it. An entry for a rule that is off or unknown fails until it is pruned. The baseline covers violations at any level.

- `quality baseline write` records every error-level violation when there is no baseline yet. Once a baseline exists it refuses, unless `--rule <id>` names the rules to record: it then replaces the entries of those rules with what the files have now, and leaves every other entry as it is.
- `quality baseline tighten` lowers and removes the entries of files changed since `HEAD`, and with `--staged`, of the files staged for the next commit. It carries the entry of a file that git sees as moved to the new path. Every other line stays byte for byte.
- `quality baseline prune` does the same for every entry. It carries the entries of files moved since the merge base (see `--against` under [Command line](#command-line)), and prunes without following moves outside a git work tree.
- `quality baseline migrate` moves a baseline from the earlier JSON format, `quality/baseline.json` or the file `--from` names, to the configured file, and removes the old one. An old entry that stored a size, such as a line count, becomes that size less the rule's current limit; an entry whose file is now within the limit is dropped.

Neither `tighten` nor `prune` ever adds or raises an entry. They lower an entry to what its file has now, and remove it when that is 0. A moved file's entry keeps the lower of its old count and what the file has now. A move is seen when both of its sides are tracked, as after `git mv`; git's rename detection decides what counts as a move.

### Pre-commit

Lowering entries in the commit that fixes them keeps the baseline current without a separate cleanup:

```sh
quality baseline tighten --staged && git add quality/baseline.jsonl
quality lint
```

`tighten` counts the files as they are on disk. When a commit stages only part of a file, stash the rest first (as lint-staged does), or the entry may be lowered below what the commit holds.

### Baseline growth

A finding that the baseline does not cover always fails `quality lint`, locally and in CI; that is how new debt gets noticed. The baseline itself may grow: a reviewer sees each new or raised entry in the diff and judges it. When the failing findings are debt the baseline should keep, such as the debt of a file that moved or was renamed, record the rule again with `quality baseline write --rule <id>`. The report ends with that command for the rules that failed. Then call out the baseline growth in the pull request description.

A rule enters the baseline the same way: set it to `error`, run `quality baseline write --rule <id>` and commit both.

### Changing a limit

A count depends on the configured limit, so changing a limit shifts every count of the rule. A looser limit leaves entries that allow more than is left: they pass, and `tighten` and `prune` lower them. A stricter limit makes the rule's files fail `quality lint`, since each is now further over the limit. Run `quality baseline write --rule <id>` to record the rule again under the new limit, and commit it with the config change. The raised entries show in the diff, and the pull request calls them out.

## Registry

```json
[
	{
		"rule": "structure/max-lines",
		"file": "src/generated/client.ts",
		"reason": "Generated from the OpenAPI document; splitting it would mean forking the generator."
	}
]
```

An entry covers a rule's violations in one file, for good, and must say why. With a `subject`, it covers only the violations with that subject. The registry applies before the baseline. An entry that covers nothing, or names a rule that is off, unknown or takes no exceptions, fails the gate until it is removed.

## Command line

```text
quality lint [--config <file>] [--warnings summary|all]
quality fix [--config <file>]
quality baseline write [--config <file>] [--rule <id>]...
quality baseline prune [--config <file>] [--against <ref>]
quality baseline tighten [--config <file>] [--staged]
quality baseline migrate [--config <file>] [--from <file>]
```

`quality` alone runs `lint`. `--against <ref>` names the branch the work merges into; `prune` follows the moves since its merge base. Without it, `prune` takes `origin/HEAD`, `origin/main` or `origin/master`, whichever exists first, and prunes without following moves when it finds no merge base. With `--against`, a missing merge base exits 2; in a shallow clone, run `git fetch --unshallow` first. The report groups violations by rule and states each rule's description once; warnings are summarized per rule with the files that have the most, and `--warnings all` lists each one.

| Exit code | Meaning |
| --- | --- |
| 0 | Passed. Warnings may remain. |
| 1 | Failed: an uncovered error-level violation, a baselined file that got worse, a stale registry entry, or a baseline entry for a rule that is off or unknown. |
| 2 | Could not run: no or invalid config, an invalid baseline or registry, a baseline left in the earlier format, a missing source, a rule that threw, git history `prune --against` cannot read, a `quality fix` that does not settle in 5 rounds, or a usage error. |

## Biome preset

`@shivaedev/quality/biome` is one Biome setup for every repository. Biome is a dependency of this package, pinned to an exact version, and `quality` runs it, so a repository needs no Biome install of its own. The root `biome.json` extends the preset and adds only what is the repository's own:

```json
{
	"$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
	"extends": ["@shivaedev/quality/biome"]
}
```

The preset sets:

- **Formatting:** tabs, a line width of 150, double quotes, semicolons, trailing commas and operators at the start of a wrapped line. An object key keeps its quotes, because a quoted key marks a [foreign name](#foreign-names).
- **Lint:** every rule Biome recommends, at `error`, and a list of stricter rules on top, among them `noUnsafeTypeAssertion`, `useBlockStatements`, `useNumericSeparators`, `useUnicodeRegex`, `useLiteralKeys`, `noFloatingPromises`, `useExhaustiveDependencies`, `it` for every test, no viewport that disables zoom (`noNonScalableViewport`), function declarations over function expressions, interfaces for object types, a cognitive complexity limit of 15, no nested ternaries, and the naming rules under [Naming](#naming).
- **Imports:** organized in five groups: Node and Bun builtins, packages, `@shivaedev/*` packages, aliases and relative paths. Biome counts as an alias a specifier that starts with `#`, `@/`, `~`, `$` or `%`; a tsconfig path such as `@app/*` sorts with the packages, and Biome's `noUndeclaredDependencies` takes it for one, so name aliases in a form Biome recognizes.
- **Assist:** organized imports and sorted keys, attributes, enum members, interface members and properties. Keys are sorted in JSON and in object literals alike, but only reported: `quality fix` leaves the order to the author. `package.json` is left out, because `manifests/sorted` gives it the order npm users expect.
- **Plugins:** GritQL rules that ban ambient time, randomness, `console` and `process.env` for Effect's services, and the naming plugins under [Naming](#naming). They load from `./node_modules/@shivaedev/quality/biome/plugins`, so the package must be installed at the repository root.
- Files ignored by git are skipped.

The preset turns off `noUnusedVariables` and `noUnusedFunctionParameters`, because the tsconfig presets report them through TypeScript, allows default exports in `*.config.*` files, which tools load through the default export, and turns off `useComponentExportOnlyModules` in `*.test.*` and `*.spec.*` files, which define the helper and harness components they render. It also turns off `noProcessGlobal`, `useJsonImportAttributes`, `noMisusedPromises`, `useExhaustiveSwitchCases`, `useSortedClasses`, `noDelete`, `useConsistentArrayType`, `useConsistentCurlyBraces`, `noEqualsToNull` and `noSkippedTests`, because `quality fix` applies every lint fix and their fixes changed behavior or did not terminate on real code. It keeps `noUndeclaredClasses` off, because the rule cannot resolve a stylesheet imported through an alias and Tailwind utilities are not declared in CSS, and `noInlineStyles` off, because an inline style is the right tool for a value computed at run time. It declares these weakenings in its `declarations.json`, so `suppressions/biome-overrides` takes them as declared and `suppressions/biome-recommended` accepts the recommended rules among them. Every other weakening a repository adds is an override it declares with a reason.

An autofix applies only a change that removes no decision; a fix that can change behavior or delete something written on purpose reports only, and the author decides. The preset keeps `noAccessKey`, `noAriaHiddenOnFocusable`, `noAutofocus`, `noInteractiveElementToNoninteractiveRole`, `noNoninteractiveElementToInteractiveRole`, `noNoninteractiveTabindex`, `noRedundantRoles`, `useValidAriaProps`, `useValidAriaRole`, `noImportantStyles`, `noConstAssign`, `noUnusedPrivateClassMembers`, `useExhaustiveDependencies`, `noFloatingPromises`, `useConsistentTestIt`, `useRegexpTest`, `useUnicodeRegex`, `noNonNullAssertion`, `useAtIndex`, `noParametersOnlyUsedInRecursion` and `useNamingConvention` at `error` with their fixes off, and `quality fix` skips `noDuplicateObjectKeys` and `useSortedKeys`, whose fixes Biome's config cannot turn off.

The `biome` rule runs `biome check` with the repository's config and reports each finding as `biome/<category>`, such as `biome/lint/style/useBlockStatements`, `biome/assist/source/useSortedKeys`, `biome/format` or `biome/plugin`, so Biome's findings go through the baseline like any other rule's. `quality baseline write --rule biome` takes in every Biome category at once. A finding below `error`, such as a rule a repository declared at `warn`, is not reported. The rule also asks for a root `biome.json` or `biome.jsonc` that extends the preset, and it takes no registry exceptions. A Biome config that Biome cannot load stops the run with Biome's message.

`quality fix` sorts every `package.json`, then runs `biome check --write --unsafe`, which applies Biome's lint fixes, unsafe ones included, its assist actions, such as organized imports, and its formatting, except the fixes that report only. It then runs Biome's formatter once more, because a lint fix can leave code unformatted. One fix can make room for another, so it repeats both passes until a round rewrites nothing, at most 5 rounds; when files still change in the fifth round, it names them and exits 2. An unsafe fix can change behavior, such as `==` becoming `===`, so review what it changed. An editor that runs Biome on save uses the same version when it resolves Biome from the root `node_modules`, so a repository that wants that installs `@biomejs/biome` at the version this package pins.

## Naming

A name says what a thing is, and the same kind of thing is named the same way everywhere. Every naming rule is an error without an autofix: nothing renames code or adds a `_` prefix. The message says what is wrong and which shapes are valid, and the author picks the name. Unused variables and parameters stay TypeScript errors; remove them instead of prefixing them.

### Identifiers

| What | Valid shape | Checked by |
| --- | --- | --- |
| Variables, functions and parameters | camelCase: `itemCount`, `loadItem`. A component or a class is PascalCase. | `useNamingConvention` |
| Acronyms | Spelled as a word: `HttpClient`, `userId`, `parseUrl`. Never `HTTPClient`, `userID` or `parseURL`. | `useNamingConvention` with `strictCase` |
| Types, interfaces, classes and enums | PascalCase, without an `I` prefix: `Item`, not `IItem`. | `useNamingConvention` |
| Type parameters | `T`, or `T` followed by a PascalCase name: `TItem`, `TResult`. Effect's positional `A`, `E` and `R` are valid as they are. | `useNamingConvention` |
| Module-level constants | A string or number literal at module level is CONSTANT_CASE: `const MAX_ITEMS = 50`. A constant inside a function is camelCase. | `constant-names` plugin, `useNamingConvention` |
| Object keys and type properties | camelCase or PascalCase, after any leading `_` or `$` (`_tag`, `$transaction`), also in a `Record`. A quoted key is a [foreign name](#foreign-names) and is not checked. | `key-names` plugin |
| Schemas | PascalCase and named like their type: `const Item = Schema.Struct(...)` with `type Item = typeof Item.Type`. | `schema-names` plugin |
| `Schema.Struct` fields | camelCase, also when quoted. Outside data keeps its keys only at the edge: `Schema.Struct({ createdAt: Schema.String }).pipe(Schema.encodeKeys({ createdAt: "created_at" }))`. | `schema-struct-keys` plugin, `key-names` plugin |
| `Effect.fn` spans | `"Owner.operation"`, where the owner is the service or module and the operation is the name the function is bound to: `const loadItem = Effect.fn("ItemStore.loadItem")`, and `loadItem: Effect.fn("ItemStore.loadItem")` in an object. | `effect-fn-spans` plugin |
| `Effect.gen` functions | A top-level function whose whole body is `Effect.gen` is an `Effect.fn`: `const loadItem = Effect.fn("ItemStore.loadItem")(function* (id: string) { … })`, or `Effect.fnUntraced` when it needs no span. | `effect-fn-functions` plugin |
| Effect test bodies | In test code, a test takes the generator itself: `it.effect("loads the item", function* () { … })`, never `() => Effect.gen(function* () { … })`. The test helper runs it with `Effect.gen`. | `effect-test-bodies` plugin |
| Service Layers | A static `layer` on the service, read as `ItemStore.layer`. No exported `ItemStoreLive` or `ItemStoreLayer` constant. A Layer that wires an application together stays unexported. | `service-layers` plugin |
| Private members | A `#field`. No `private`, `protected` or `public` modifier. | `useConsistentMemberAccessibility` |
| React | A function passed to an `onX` prop is `handleX`, an `onX` prop forwarded as it is, or a state setter passed as it is: `onOpenChange={setOpen}`. A context is `ThemeContext`, a ref `inputRef`, an id `fieldId`. A module that exports a component exports only components; a test may define the components it renders. | `handler-names` plugin, `useReactNamingConvention`, `useComponentExportOnlyModules` |
| Booleans | A question: `isOpen`, `hasSave`, `canRetry`, `shouldFlush`. A name the DOM or React gives, such as `open` or `disabled`, stays. This is a convention only; no rule checks it. | Review |

### Foreign names

Some names are not ours to choose: a query parameter an outside API reads, an environment variable, an operator a query builder takes. Write such a name as a quoted key, and the naming rules skip it:

```ts
const query = { "per_page": 50, "sort_by": "created" };
const env = { "DATABASE_URL": url };
const where = { "OR": [{ id }, { slug }] };
```

An unquoted key is our own name and is camelCase or PascalCase. The formatter keeps the quotes as written, so a quoted key stays quoted. A `Schema.Struct` field is the exception: the struct is our model of the data, so the `schema-struct-keys` plugin reports a snake_case field even when it is quoted, and points to `Schema.encodeKeys`, which maps camelCase fields to the outside names at the edge.

### Re-exports

No file re-exports, package entry files included: every module is imported from the file that defines it. `noBarrelFile` reports `export { … } from`, `noReExportAll` reports `export *`, the `type-re-exports` plugin reports `export type … from`, and `noExportedImports` reports an import that is exported again. Its message suggests `export … from`, which is a re-export as well: import the name where it is used instead.

The plugins report under the one Biome category `plugin`, so their findings share the baseline rule `biome/plugin`.

### Files

`files/named-after-export` names a code file after its main export, and the folders above it are the prefix. The export takes the words of the file name, in order, and may add words of its folders around them, in any order and in singular or plural. Folders count from the package root, without a leading `src`; the package name does not count. The file's first letter follows the export's case.

| File | Exports | Valid |
| --- | --- | --- |
| `routers/items/list.ts` | `listItems` or `itemList` | Yes |
| `routers/items/Create.ts` | `CreateItemRouter` | Yes |
| `item/Panel.tsx` or `ItemPanel.tsx` | `ItemPanel`, with `ItemPanelProps` beside it | Yes |
| `Panel/Panel.tsx` | `Panel`: the main file of a module folder repeats the folder | Yes |
| `limits.ts` | `MAX_ITEMS` and `MAX_DEPTH`: a topic file of several exports is camelCase | Yes |
| `ItemPanel.tsx` | `export default memo(ItemPanel)`: a default export counts under the name it resolves to | Yes |
| `setupTests.ts` | Nothing, so it is camelCase | Yes |
| `script/build-docs.ts` | Run by a `package.json` script or `bin`, or starts with `#!`, so it is kebab-case | Yes |
| `order.ts` | `type Order` | No: the file's case follows the export, so it is `Order.ts` |
| `maxItems.ts` | `MAX_ITEMS` alone | No: constants live in a topic file with related constants |
| `items/listItems.ts` | `listItems` | No: the folder is the prefix, so it is `items/list.ts` |

Test files are left to the test rules. The `toolOwned` option lists `.gitignore` patterns of files whose names a tool fixes, `*.config.*` and declaration files by default.

### Folders

`files/folder-names` checks every folder above a checked file.

- A module folder takes the name of its main file, inside it or beside it: `Panel/` with `Panel/Panel.tsx`, or `Dialog/` beside `Dialog.tsx`. A PascalCase folder without that file is a finding.
- A package folder is its package name without the scope, so `@acme/ui-kit` lives in `ui-kit/`.
- A folder that only groups files is kebab-case: `test-support/`, `.github/`.
- A folder the `content` option lists is snake_case: `forest_path/`.

The `toolOwned` option lists folders a tool names, `generated/` and `migrations/` by default.

### Other files

`files/other-names` names the files that are not code.

- Markdown, JSON, GritQL, images, fonts and SVG are kebab-case, with optional dotted parts: `release-notes.md`, `icons.sprite.svg`. Conventional upper-case names stay: `README.md`, `CHANGELOG.md`, `LICENSE`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md` and `SKILL.md`.
- A stylesheet that one component imports is named after it: `ItemPanel.css` beside `ItemPanel.tsx`. A shared stylesheet is kebab-case: `form-controls.css`. An import is a static `import` in a code file, relative or through a `#` alias from the `imports` of its `package.json`, or an `@import` in a stylesheet; a stylesheet that another stylesheet imports is shared. A path in a string, such as a test that reads the file, is not an import.
- A Prisma schema is camelCase: `schema.prisma`.
- A file the `content` option lists is snake_case: `forest_path.json`. A double underscore separates the parts of an id: `forest_path__clearing.json`.

The `toolOwned` option lists files a tool names: dotfiles, `package.json`, `tsconfig*.json`, `biome.json`, `*.config.*`, `migrations/` and `generated/` by default.

### Tests

A test sits beside the code it covers, and its name says what it covers and where it runs.

| File | Covers | Valid |
| --- | --- | --- |
| `cart/cart.test.ts` | `cart/cart.ts` | Yes |
| `cart/cart.typecheck.test.ts` | The types of `cart/cart.ts`, checked by the compiler | Yes |
| `cart/Basket.dom.test.tsx` | `cart/Basket.tsx`, in a DOM | Yes |
| `cart/checkoutFlow.spec.ts` | A behaviour of the `cart/` folder as a whole, such as a flow across several files | Yes |
| `cart/checkoutFlow.dom.spec.tsx` | The same, in a DOM | Yes |
| `cart/checkoutFlow.typecheck.spec.ts` | The types of that behaviour, checked by the compiler | Yes |
| `cart/totals.test.ts` | No `cart/totals.ts` beside it | No: a `.test` follows a file, and a test of the folder is a `.spec` |
| `cart/cart.spec.ts` | | No: a `.spec` names a behaviour, so it may not share a stem with a file beside it |
| `cart/cart.hydration.test.ts` | | No: an aspect gets its own file in the module's folder, or a `.spec` |
| `cart/cart.postgres.test.ts` | | No: a database or a running app comes from the app's test fixture, not a file name |
| `test/cart.test.ts` | | No: a test folder mirrors the source tree; the test sits beside `cart.ts` |

`tests/follow` checks the name: `<file>[.<environment>].test.ts` beside its file, or `<behaviour>[.<environment>].spec.ts` in camelCase in the folder it covers. The environment is at most one of `dom`, `slow` and `typecheck`, the ones the [Vitest projects](#vitest-projects) run, and a test that imports `@testing-library/*` or reads `document` or `window` is a `.dom` test.

`tests/colocated` checks the place: a test in a `test`, `tests`, `__tests__` or `spec` folder is a finding.

Both rules take a `suites` option, `.gitignore` patterns of folders that hold tests with their own layout, such as tests across several packages or a Playwright suite, whose `.spec.ts` files mean something else. The rules skip those folders.

### Test code

Test code is a test file, as `tests/follow` reads the name (`*.test.ts` or `*.spec.ts`, with any environment), or any file under a folder named `test-support/`. `test-support/` is the one folder name for the fixtures, harnesses and generated clients that tests share. Test code ships nowhere, so the rules that check shipped code skip it: `imports/fences` never holds it, and `structure/max-lines` gives it the test limit. The test rules still read only test files: a file under `test-support/` is not a test, so `tests/follow`, `tests/colocated` and `tests/story-setup` leave it alone.

## Story tests

A test reads as a short story over the domain: what exists, what someone does, and what is true afterwards. The words come from a story kit that the repository keeps in `test-support/`, built with [`@shivaedev/test-story`](https://github.com/ShivaeDev/platform/tree/main/packages/test-story#readme), so a test says what it needs in domain words and never builds state by hand.

```ts
shop.it("ships a paid order from stock", [hasInStock(3, "lamp"), hasInCart(1, "lamp")], function* ({ customer, warehouse }) {
	customer.checksOut();
	yield* warehouse.shipsEverything();

	expect(warehouse.shipped()).toEqual(["lamp"]);
	expect(warehouse.inStock("lamp")).toBe(2);
});
```

- **Setup is traits.** A trait is one sentence of setup in domain words and the change it makes, such as `hasInStock(3, "lamp")`. A test hands the traits it needs to the kit's `it`, which starts a fresh engine and seeds them, and a setup that recurs becomes one named trait made of others. A trait that asks for an impossible state refuses and fails the test, instead of seeding it quietly.
- **Actions go through real entry points.** The test acts through the kit's verbs, which reach the command, service, route or UI path a user or caller reaches, never by writing internal state. A verb that lets the engine run, such as `warehouse.shipsEverything()`, steps it with `story.runUntil` until what it waits for holds.
- **Failures print the story.** Every trait, verb and engine step tells a line of the story, and a failing test prints the story with where it stopped and the engine's state, so the failure says what happened, not only which values differ.

`tests/story-setup` holds test files to this. In a test file, it reports:

- a top-level function whose name starts with the word `seed`, `make`, `build` or `setup`, declared as a function or as a variable that holds an arrow function or function expression: `function seedCart()`, `const makeRun = () => …`. The prefix is a whole word, so `builder` and `settings` pass;
- a call that writes fixture files through Node's `fs` or `fs/promises`: `writeFile`, `appendFile`, `mkdir`, `mkdtemp`, `copyFile`, `cp` and `symlink`, each in its sync form too, whether imported by name, through a namespace or default import, or through `promises`.

Each finding names its line and has the helper or the function it calls as its subject. Its message asks for the setup as traits of the story kit in `test-support/` and points here. A file under `test-support/` is not a test, so the kit itself builds state and writes files freely. The rule only reports; nothing rewrites a test. A repository adopts it through the baseline: `quality baseline write --rule tests/story-setup`.

## Vitest projects

`@shivaedev/quality/vitest.ts` sets up the tests of a package by file name, so no test file sets its environment with a pragma. It needs `vitest`, and `happy-dom` for DOM tests. A package's `vitest.config.ts` reads:

```ts
import { testProjects } from "@shivaedev/quality/vitest.ts";
import { defineConfig } from "vitest/config";

export default defineConfig({ test: testProjects() });
```

| Project | Files | Environment | Runs |
| --- | --- | --- | --- |
| `unit` | `*.test.ts`, `*.spec.ts` and the other test and spec files | Node | By default |
| `dom` | `*.dom.test.tsx`, `*.dom.spec.tsx` and the other `.dom` files | happy-dom | By default |
| `slow` | `*.slow.test.ts`, `*.slow.spec.ts` and the other `.slow` files | Node | Only with `vitest run --project slow` |

Type tests (`*.typecheck.test.ts`, `*.typecheck.spec.ts` and `typecheck.test.ts`) are in no project: the compiler checks them. A test that is too slow for every run goes into the slow project instead of being skipped.

A folder that another runner owns, such as a Playwright suite of `.spec.ts` files, is left out with `testProjects({ exclude: ["e2e/**"] })`; the globs are added to every project's `exclude`.

### Inherited tags

Vitest gives an inline project only the [tags](https://vitest.dev/guide/test-tags) it declares itself, never those of a config file it `extends`. A test tagged in that file then fails with `cannot apply "<tag>" tag for this test` as soon as a root config runs it. A root config that gathers the projects of several packages, or whose projects extend a shared base config, passes them through `inheritTags`:

```ts
import { inheritTags } from "@shivaedev/quality/vitest.ts";
import { defineConfig } from "vitest/config";

const bakery = { extends: "./packages/bakery/vitest.config.ts", root: "./packages/bakery", test: { name: "bakery" } };

export default defineConfig(async () => ({ test: { projects: await inheritTags([bakery], import.meta.dirname) } }));
```

`inheritTags(projects, root)` loads the config file of each inline project whose `extends` is a path, resolved against `root`, and adds the tags that file declares to the project's own, so `vitest run --tags-filter=<tag>` works across the workspace. A tag the project declares itself wins over an inherited one of the same name. The config may export an object, a promise or a function. A project that extends `true`, and a glob or file path, comes back unchanged, because Vitest already gives those the root's tags. The extended files load with Node's own `import`, as `vitest --configLoader native` loads configs, so each must be a module Node runs without a bundler.

## tsconfig presets

Two presets hold one strict, current TypeScript setup for every repository. They target TypeScript 7.

| Preset | Use |
| --- | --- |
| `@shivaedev/quality/tsconfig/base.json` | Type-checking with `noEmit`: applications, tests and scripts. |
| `@shivaedev/quality/tsconfig/package.json` | Building a package: the base plus `declaration`, `declarationMap`, `sourceMap` and `rewriteRelativeImportExtensions`, so relative `.ts` imports are emitted as `.js`. |

```json
{
	"extends": "@shivaedev/quality/tsconfig/base.json",
	"compilerOptions": {
		"lib": ["ESNext", "DOM"],
		"types": ["node"]
	},
	"include": ["src", "test"]
}
```

The base sets:

- **Language:** `target` and `lib` ESNext, so the newest syntax is emitted as written and the newest built-ins are typed.
- **Modules:** `module` ESNext, `moduleResolution` bundler, `moduleDetection` force, `verbatimModuleSyntax`, `isolatedModules`, `allowImportingTsExtensions`, `resolveJsonModule`, `noUncheckedSideEffectImports`, `forceConsistentCasingInFileNames` and `libReplacement: false`.
- **JavaScript:** `allowJs` and `checkJs`, so JavaScript files are type-checked with the TypeScript ones.
- **Erasable syntax only:** `erasableSyntaxOnly` rejects syntax that type stripping cannot erase, such as parameter properties.
- **Checks:** `strict`, with `noImplicitAny`, `strictBuiltinIteratorReturn` and `useUnknownInCatchVariables` stated explicitly, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `allowUnreachableCode: false` and `allowUnusedLabels: false`.
- **Compilers:** `stableTypeOrdering`, so a TypeScript 6 build orders types the way TypeScript 7 does, and `skipLibCheck`.

`noPropertyAccessFromIndexSignature` stays off, so a map-like key is read with dot access, and `isolatedDeclarations` stays off, so exported values keep their inferred types. `types`, `jsx`, `paths`, `include` and the output directories belong to each project. A project that needs more built-ins, such as the DOM, sets `lib` itself and keeps `ESNext` in it.

A package that type-checks its tests with one config and builds `src` with another extends both, the package preset last:

```json
{
	"extends": ["./tsconfig.json", "@shivaedev/quality/tsconfig/package.json"],
	"compilerOptions": { "outDir": "dist", "rootDir": "src" },
	"include": ["src"]
}
```

## Validation

`pnpm ready` checks formatting, TypeScript 7, the rules, the import graph against seeded repositories and the fence policy against its examples, config, discovery, registry, baseline and report behavior, the command line against seeded repositories and git histories, the Biome preset against every rule Biome recommends and against its declarations, its naming rules and plugins against seeded files that break and keep each one, the file, folder, other-file and test naming rules against seeded trees, `tests/story-setup` against seeded test, source and `test-support/` files, the `biome` and `manifests/sorted` rules and `quality fix` against seeded repositories, the Vitest projects against a seeded repository that Vitest runs, an installed tarball consumer that type-checks a config and runs the `quality` bin through a baseline that takes in the preset's lint and plugin findings, and installed consumers that extend each tsconfig preset, type-check a fixture with an expected error for each check the base turns on, and run the package preset's build output.
