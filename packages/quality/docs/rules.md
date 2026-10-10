# Rule reference

Use the [README](../README.md) for the gate's mental model and workflow. Quality owns the shared policy; consuming repositories adopt its defaults. This reference gives each built-in rule's scope, findings and accepted options, including the exposed local-rule API. An option being accepted is not a recommendation to tune the shared standard. Supply repository facts, such as generated locations and import boundaries, when a check needs them. The [naming reference](./naming.md) covers names and test layout; [shared tooling](./tooling.md) covers the Biome, Vitest and TypeScript setup.

## File size

`structure/max-lines` keeps each module to one job: a source file may have 150 lines and [test code](./naming.md#test-code) 300, counted the way an editor numbers them. Declaration files are exempt. Its options are `source` and `test` (positive integer limits) and `testFiles`, `.gitignore` patterns of further folders whose files count as tests, such as a Playwright suite in `e2e/` (none by default). A file over its limit counts one violation for each line above it: 168 lines under a limit of 150 count 18.

### Comments

A comment says why, never what the code already says or what it used to be. Seven rules hold every comment to that:

| Rule | Reports | Options |
| --- | --- | --- |
| `comments/no-jsdoc` | Every `/** */` block, except a tool pragma the config allows | `allow` |
| `comments/no-line-reference` | A line number: `file.ts:42`, `file.ts#L42`, `line 42` | none |
| `comments/no-pr-reference` | A pull request or issue: `#123`, `PR 123`, `MR 123`, `pull request 123`, `merge request 123`, `issue 123`, `ticket 123`, `/pull/123`, `/pulls/123`, `/issues/123`, `/merge_requests/123`, `GH-123` | none |
| `comments/no-banner` | A banner, divider or region: a line that starts or ends with three or more of `- = * # ~ _ + / \ ─ ━ ═ ┄ ┈`, `#region`, `#endregion` | none |
| `comments/no-todo` | `TODO`, `FIXME`, `XXX` and `@todo` | none |
| `comments/no-environment-pragma` | A test environment set by a `@vitest-environment` or `@jest-environment` pragma (and its `-options`); name the file `*.dom.test.ts` instead, see [Vitest projects](./tooling.md#vitest-projects) | none |
| `comments/max-per-file` | A file with more than `max` comments, 2 by default | `max` (a nonnegative integer), `allow` |

The rules find comments with the TypeScript parser, so text inside strings, template literals, regular expressions and JSX never counts as a comment. They read the TypeScript and JavaScript modules among the sources and skip declaration files and the directives listed below. Each finding names the line its comment starts on.

Write a comment only for what the code cannot show, such as a constraint or a reason. The default limit of two comments is a tripwire against runaway commentary, not a budget to fill.

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
| `suppressions/biome-recommended` | A rule the installed Biome recommends that the [Biome preset](./tooling.md#biome-preset) neither sets to `error` nor declares | none |
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

A type test proves that an API rejects what its types forbid, and TypeScript asserts a compile error only through `@ts-expect-error`, which fails as soon as the error it expects goes away. So `@ts-expect-error`, and no other directive, is allowed in a type test: a file named `*.typecheck.test.ts`, `*.typecheck.spec.ts` or `typecheck.test.ts` (or `.tsx`). The compiler checks these files; [Vitest projects](./tooling.md#vitest-projects) never run them. `@ts-ignore`, `@ts-nocheck` and every linter and formatter directive stay reported in them. A test that must pass a rejected value at run time, to prove the runtime refuses it too, calls the API through `Reflect.apply` instead of a directive.

`suppressions/no-double-cast` finds casts with the TypeScript parser, through parentheses and in either assertion syntax. A single cast is left to the linter, and `as const` is not a cast.

#### Declared Biome overrides

Quality ships reasons for its own internal Biome exceptions. The consumer declaration API below also accepts weakenings; that is an implementation gap against the whole-policy direction, recorded in the [roadmap](./roadmap.md). Extend the shared configuration and use the baseline for debt rather than creating a weaker policy. The following describes the validation surface for an existing consumer override. `suppressions/biome-overrides` reads `biome.json` or `biome.jsonc` at the root, every nested `biome.json` and `biome.jsonc` among the checked files, and the configs each of them `extends`, resolved the way Biome resolves them (see [Shared presets](#shared-presets)). These settings count as overrides, at the top level and in every `overrides` entry:

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

`suppressions/biome-recommended` holds the [Biome preset](./tooling.md#biome-preset) to every rule Biome recommends, so a Biome upgrade that adds a recommended rule, or recommends one the preset leaves below `error`, fails the gate until the preset takes a position on it. It asks the installed Biome, the one `quality` runs, which rules its `recommended` preset enables, through `biome rage --linter`, so the list is never written down. When the root Biome config extends `@shivaedev/quality/biome`, it reads that preset and its `declarations.json`, resolved from the repository root as under [Shared presets](#shared-presets); a repository that does not extend the preset is left to the `biome` rule, which asks for it. A recommended rule is in order when the preset's `linter.rules` sets it to `error`, directly or through its group's severity, or when a declaration names it, whatever the declaration's `includes`. Every other recommended rule is reported at the preset, one finding per rule: set it to `error`, or declare why not.

### Imports

Four rules check the imports of the TypeScript and JavaScript modules among the sources. `imports/cycles`, `imports/resolvable` and `imports/fences` with declared fences build a graph resolved by the TypeScript compiler. `imports/aliased` checks relative path syntax.

| Rule | Reports | Options |
| --- | --- | --- |
| `imports/cycles` | Modules that import each other at run time | none |
| `imports/resolvable` | An import that resolves to nothing | `generated` |
| `imports/fences` | An import that crosses a fence the config declares | `fences` |
| `imports/aliased` | A relative import that leaves its own folder | none |

Each graph edge resolves the way the compiler resolves it, with the options of the nearest `tsconfig.json` and the projects it references, under bundler resolution: `paths`, `package.json` `imports` and `exports` and the `source` condition hold, so a workspace package resolves to its source. The graph reads literal specifiers in static and dynamic imports, `export ... from`, `require()`, `require.resolve()`, `import.meta.resolve()` of a bare specifier (a relative one is URL arithmetic that never checks the path), `import()` types, `/// <reference types>`, `/// <reference path>` and JSDoc `@import` tags. Computed specifiers are outside this check.

- An import of a stylesheet, an image or JSON resolves to the file, and only when the file exists, whatever declaration describes it. A Node builtin resolves.
- A runtime import must resolve to code: a declaration file (`.d.ts`, `.d.mts`, `.d.cts`, or an asset declaration such as `.d.css.ts`) satisfies only `import type` and `export type`, however the import reaches it, so a package that has only its `@types` package installed, or an `exports` entry that points at a declaration, is reported.
- A bare import resolves when a declaration file of the importer's tsconfig project declares the module in a script (`declare module "virtual:*"`). A relative import always needs a real file, `declare module "*"` and patterns with more than one `*` never count, and a `declare module` inside a module is an augmentation, which declares nothing new.
- A relative import or a `#` package import of a missing file resolves only inside a folder that `generated` names, such as a client a generator writes before the tests run. A `#` import lands where its `imports` entry in `package.json` points once the file exists. Each folder must be ignored by git, or at least every file an import names in it must be, hold no file git tracks but a `.gitkeep` or `.keep` placeholder, lie outside `node_modules` and hold a file that an import names. The import stays an edge to its path, so fences apply to it before the file exists.
- A module that resolves into `node_modules` or outside the root is external, and its package is the one it resolves into, whatever alias the import uses. A `@types` package counts as the package it describes: `@types/hast` is `hast`, `@types/scope__name` is `@scope/name`.

```ts
import { defineConfig } from "@shivaedev/quality/config.ts";

export default defineConfig({
	rules: { "imports/resolvable": { options: { generated: ["packages/db/src/test-support/generated"] } } },
});
```

`imports/cycles` reports each group of modules that import each other at run time once, at the alphabetically first of them, with one loop through the group. Its count is the number of modules in the group. `import type`, `export type`, type references and imports in declaration files are left out; `import { type X }` stays a runtime import. Dynamic `import()` and `require()` count; `require.resolve()` does not. It takes no registry exceptions. Each finding of `imports/resolvable` has the import as its subject.

When the sources hold no module at all, the graph-building rules stop the run instead of passing on an empty graph. Point `sources` at the code; do not disable the checks to conceal an empty inventory. `imports/aliased` does not require a graph, and `imports/fences` does nothing when no fences are declared.

#### Aliases

A relative import names only a file in its own folder, such as `./format.ts`: the folder is one module. Every other import goes through an alias, so moving a file never rewrites a chain of `../`:

- the `imports` of the importer's nearest `package.json`, such as `"#lib/*": "./src/lib/*"`, or `"#shared/*": "@demo/shared/*"`, which names another workspace package;
- the name of another workspace package, as far as its `exports` reach.

An import that already goes through a tsconfig `paths` alias is not relative, so the rule leaves it alone.

`imports/aliased` reports a relative import that goes up (`../format.ts`) or down into a subfolder (`./parts/deeper.ts`, or `./widgets` for `widgets/index.ts`). It reads literal specifiers in static imports, `export ... from`, side-effect imports, `import()`, `require()`, `import()` types, JSDoc `@import` tags and the paths of `vi.mock`, `vi.doMock`, `vi.unmock`, `vi.doUnmock`, `vi.importActual` and `vi.importMock`, so a mock keeps pointing at the module it replaces. An escaped path, such as `"\x2e\x2e/format.ts"`, counts as the path it spells. Each finding has the import as its subject. Its message names the fix for where the import lands:

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

Fences guard shipped code, and [test code](./naming.md#test-code) ships nowhere, so a fence never holds it: a test file or a file under `test-support/` may import across every fence. There is no option to check them.

A finding has its fence's name as its subject, so a registry entry with that subject excuses one file from one fence.

### Manifests

`manifests/sorted` keeps every `package.json` in the repository in the key order of [sort-package-json](https://github.com/keithamus/sort-package-json), a dependency of this package. It walks the whole repository, not only the sources, and skips files ignored by git and `node_modules`. A manifest that is not valid JSON is reported too. `quality fix` sorts the manifests, and the rule takes no registry exceptions.

## Local-rule API

The API allows a local rule to receive checked source text and return findings. This is an extension reference, not a step every repository must complete; reusable quality policy belongs in the shared package. This example is the same text-scanning rule exercised by the package's CLI tests:

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
