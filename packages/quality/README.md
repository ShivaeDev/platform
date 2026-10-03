# @shivaedev/quality

One quality gate for a repository: typed rules, one report, a baseline that only shrinks and a registry of permanent exceptions, each with its reason.

Every rule is an error by default. A repository adopts the gate at once: it records its existing violations in the baseline, and from then on a baselined file may not get worse, the baseline may not gain an entry or a higher number, and fixed debt leaves it as files change.

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
import { defineConfig } from "@shivaedev/quality";
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
| `baseline` | `quality/baseline.jsonl` | Existing violations that may only shrink. |
| `adopt` | `[]` | Rules the baseline takes in for the first time; see [Adopting a rule](#adopting-a-rule). |
| `local` | `[]` | The repository's own rules, made with `defineRule`. |
| `rules` | every rule at `error` | A level per rule id, or `{ level, options }`. |

The config is typed: an unknown rule id, a misspelled option or an option of the wrong type fails to compile. It is also validated when loaded, so a JavaScript config gets the same checks.

## Levels

- `error` is the default. An error-level violation that the baseline and the registry do not cover fails the gate.
- `warn` reports without failing. It exists for the transition to a new rule and is meant to be temporary: move the rule to `error` and baseline what is left.
- `off` disables the rule.

## Rules

`structure/max-lines` keeps each module to one job: a source file may have 150 lines and a test file 300, counted the way an editor numbers them. Declaration files are exempt. Its options are `source` and `test` (the limits) and `testFiles`, `.gitignore` patterns that mark test files (`*.test.*`, `*.spec.*`, `test/`, `tests/` and `__tests__/` by default). A file over its limit counts one violation for each line above it: 168 lines under a limit of 150 count 18.

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

A check that is silenced at one site hides the problem instead of fixing it. Three rules close the escape hatches, and none of them takes registry exceptions: a registry entry that names one fails the gate as stale. A repository with existing suppressions adopts the rules through the baseline, which only shrinks.

| Rule | Reports | Options |
| --- | --- | --- |
| `suppressions/no-inline` | Every comment directive that silences a linter, the compiler or a formatter, except `@ts-expect-error` in a type test | none |
| `suppressions/no-double-cast` | A cast through `unknown`, `any` or `never`: `x as unknown as T`, `x as any as T`, `x as never as T`, `<T><unknown>x` | none |
| `suppressions/biome-overrides` | A Biome setting that turns a check off or down, or keeps files out of it, without a declaration, and a declaration that matches no setting | `declared` |

`suppressions/no-inline` reports these directives, wherever a line of a comment starts with one:

- Biome: `biome-ignore`, `biome-ignore-all` and `biome-ignore-start`, for lint, assist and format alike. The `biome-ignore-end` that closes a range is not reported again.
- TypeScript: `@ts-ignore`, `@ts-expect-error` and `@ts-nocheck`. `@ts-check` turns checking on and is allowed.
- Other linters: `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line` and inline rule settings such as `/* eslint no-console: "off" */`; the same `-disable` forms of `oxlint` and `stylelint`; `deno-lint-ignore` and `deno-lint-ignore-file`; `tslint:disable…`.
- Formatters: `prettier-ignore`, since `prettier --check` fails on the code it skips.
- Flow: `$FlowFixMe`, `$FlowIgnore`, `$FlowExpectedError`, `$FlowIssue` and `@noflow`.

Coverage hints (`c8 ignore`, `v8 ignore`, `istanbul ignore`) are allowed: they leave code out of a coverage measure and silence no linter or compiler. The rule reads the TypeScript and JavaScript modules among the sources, declaration files included, and every `.css`, `.scss` and `.less` file among the checked files, whatever `extensions` says. Each finding names the line its comment starts on and has the directive as its subject.

#### Type tests

A type test proves that an API rejects what its types forbid, and TypeScript asserts a compile error only through `@ts-expect-error`, which fails as soon as the error it expects goes away. So `@ts-expect-error`, and no other directive, is allowed in a type test: a file named `*.typecheck.test.ts` or `typecheck.test.ts` (or `.tsx`). The compiler checks these files; [Vitest projects](#vitest-projects) never run them. `@ts-ignore`, `@ts-nocheck` and every linter and formatter directive stay reported in them. A test that must pass a rejected value at run time, to prove the runtime refuses it too, calls the API through `Reflect.apply` instead of a directive.

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

### Imports

Three rules read the import graph of the TypeScript and JavaScript modules among the sources. They build it once per run with the TypeScript compiler, without a bundler or another dependency.

| Rule | Reports | Options |
| --- | --- | --- |
| `imports/cycles` | Modules that import each other at run time | none |
| `imports/resolvable` | An import that resolves to nothing | `generated` |
| `imports/fences` | An import that crosses a fence the config declares | `fences` |

Each import resolves the way the compiler resolves it, with the options of the nearest `tsconfig.json` and the projects it references, under bundler resolution: `paths`, `package.json` `imports` and `exports` and the `source` condition hold, so a workspace package resolves to its source. The graph reads static and dynamic imports, `export ... from`, `require()`, `require.resolve()`, `import.meta.resolve()`, `import()` types, `/// <reference types>`, `/// <reference path>` and JSDoc `@import` tags.

- An import of a stylesheet, an image or JSON resolves to the file. A Node builtin resolves.
- A runtime import must resolve to code: a declaration file (`.d.ts`, `.d.mts`, `.d.cts`) satisfies only `import type` and `export type`, however the import reaches it, so a package that has only its `@types` package installed, or an `exports` entry that points at a declaration, is reported.
- A bare import resolves when a declaration file of the importer's tsconfig project declares the module in a script (`declare module "virtual:*"`). A relative import always needs a real file, `declare module "*"` and patterns with more than one `*` never count, and a `declare module` inside a module is an augmentation, which declares nothing new.
- A relative import of a missing file resolves only inside a folder that `generated` names, such as a client a generator writes before the tests run. Each folder must be ignored by git, hold no file git tracks, lie outside `node_modules` and hold a file that an import names. The import stays an edge to its path, so fences apply to it before the file exists.
- A module that resolves into `node_modules` or outside the root is external, and its package is the one it resolves into, whatever alias the import uses. A `@types` package counts as the package it describes: `@types/hast` is `hast`, `@types/scope__name` is `@scope/name`.

```ts
"imports/resolvable": { options: { generated: ["packages/db/test/generated"] } },
```

`imports/cycles` reports each group of modules that import each other at run time once, at the alphabetically first of them, with one loop through the group. Its count is the number of modules in the group. `import type`, `export type`, type references and imports in declaration files are left out; `import { type X }` stays a runtime import. Dynamic `import()` and `require()` count; `require.resolve()` does not. It takes no registry exceptions. Each finding of `imports/resolvable` has the import as its subject.

The gate fails closed: when the sources hold no module at all, the imports rules stop the run instead of passing on an empty graph. Point `sources` at the code, or turn the rules off.

#### Fences

A fence is one prohibition, stated in the config without patterns:

```ts
import { defineConfig, external, fence, folders, packages } from "@shivaedev/quality";

const fences = [
	fence("ui-never-imports-server")
		.because("The UI ships to browsers.")
		.from(folders("packages/ui/src"))
		.mayNotImport(packages("server"))
		.demonstratedBy({
			illegal: ["packages/ui/src/index.ts", "packages/server/src/index.ts"],
			legal: ["packages/ui/src/index.ts", external("effect")],
		}),
];

export default defineConfig({ rules: { "imports/fences": { options: { fences } } } });
```

A fence has a name, a reason, the modules it holds (`from`) and one prohibition:

- `mayNotImport(target)`: no module it holds imports the target.
- `mayNotReach(target)`: nothing a module it holds imports, directly or through other modules of the repository, is the target. The finding names the path.
- `mayImportOnly(...subjects).of(unit)`: the modules it holds import only the named modules or folders directly in a package's `src` folder (or the package folder) or in a folder.

Targets are `packages(...)` (workspace packages by name, with or without their scope; a workspace package is a named `package.json` that `pnpm-workspace.yaml` or the root `package.json` `workspaces` includes, and a `packages` list the gate cannot read stops the run, and it holds every file below it that no deeper workspace package holds), `folders(...)`, `files(...)`, `modules(...)` (external packages by package name, and Node builtins), `scopes(...)` (every external package of a scope), `anyOf(...)`, `workspace` (every workspace package) and `anything`. Each takes `.except(...)`.

The config does not compile without `demonstratedBy`, and the rule checks the examples against the policy: each is a chain of imports from a file of the repository, which may end in `external(name)`. The illegal example must cross this fence and no other; the legal example must cross none. Every name a fence uses must exist: a package, a folder that holds checked files, a checked file, a subject of the unit. Two fences may not share a name, and each needs a reason. A policy that breaks any of this stops the run. Fences count type imports too.

A finding has its fence's name as its subject, so a registry entry with that subject excuses one file from one fence.

### Local rules

```ts
import { defineRule } from "@shivaedev/quality";

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
quality baseline check
```

`tighten` counts the files as they are on disk. When a commit stages only part of a file, stash the rest first (as lint-staged does), or the entry may be lowered below what the commit holds.

### Baseline check

`quality lint` reads only the working tree, so on its own it cannot tell a raised entry from a recorded one: a hand edit, or deleting the baseline and writing it again, would hide new debt. `quality baseline check` compares the baseline with its version at the merge base of `HEAD` and the target branch, and fails when:

- an entry is new, for a rule the base baseline already covers;
- an entry's `count` is higher than at the base;
- a rule is baselined for the first time without `adopt` naming it;
- `adopt` names a rule with nothing baselined.

It compares with the merge base, never the tip of the target branch, so a branch that is behind never fails for debt the target branch paid off since. An entry whose file git sees as moved since the merge base is compared with the entry at the old path. When the base holds the earlier JSON format at `quality/baseline.json`, the check converts it the way `migrate` does, so the change that migrates the baseline passes.

The check reads git, not the sources, so it is cheap enough for every commit; only a base in the earlier format makes it run the rules. The target is `--against <ref>`, or else `origin/HEAD`, `origin/main` and then `origin/master`, whichever exists first. In a shallow clone that does not reach the merge base, it runs `git fetch --unshallow`, which never stops to ask for a password, and looks again. It exits 2 when there is no git work tree, no target or no merge base, including when that fetch fails; then check out with `fetch-depth: 0` in GitHub Actions, or fetch enough history for `git merge-base HEAD <target>` to succeed.

### Adopting a rule

A rule enters the baseline for the first time only while the config names it under `adopt`, so the adoption shows in the config's diff, not only in the baseline's:

```ts
export default defineConfig({
	adopt: ["comments/no-jsdoc"],
});
```

Run `quality baseline write --rule comments/no-jsdoc` with the rule at `error`, and commit both. `adopt` lets in only rules that the base baseline does not cover: once the adoption is merged, the rule's entries only shrink like any other. Leave the rule in `adopt` while it has debt; when its last entry is gone, the check fails until it is removed, so `adopt` cannot let the rule back in later. The first baseline of a repository adopts each of its rules the same way.

### Changing a limit

A count depends on the configured limit, so changing a limit shifts every count of the rule. A looser limit leaves entries that allow more than is left: they pass, and `tighten` and `prune` lower them. A stricter limit makes the rule's files fail `quality lint`, since each is now further over the limit. Run `quality baseline write --rule <id>` to record the rule again under the new limit, and commit it with the config change. `quality baseline check` then fails on the raised entries, as it does for any growth; the change merges only when an owner of the repository merges it over the failed check on purpose.

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
quality baseline check [--config <file>] [--against <ref>]
quality baseline migrate [--config <file>] [--from <file>]
```

`quality` alone runs `lint`. `--against <ref>` names the branch the work merges into. The report groups violations by rule and states each rule's description once; warnings are summarized per rule with the files that have the most, and `--warnings all` lists each one.

| Exit code | Meaning |
| --- | --- |
| 0 | Passed. Warnings may remain. |
| 1 | Failed: an uncovered error-level violation, a baselined file that got worse, a stale registry entry, a baseline entry for a rule that is off or unknown, or a baseline that grew against the merge base. |
| 2 | Could not run: no or invalid config, an invalid baseline or registry, a baseline left in the earlier format, a missing source, a rule that threw, git history the check cannot read, or a usage error. |

## Biome preset

`@shivaedev/quality/biome` is one Biome setup for every repository. Biome is a dependency of this package, pinned to an exact version, and `quality` runs it, so a repository needs no Biome install of its own. The root `biome.json` extends the preset and adds only what is the repository's own:

```json
{
	"$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
	"extends": ["@shivaedev/quality/biome"]
}
```

The preset sets:

- **Formatting:** tabs, a line width of 150, double quotes, semicolons, trailing commas and operators at the start of a wrapped line.
- **Lint:** every rule Biome recommends, at `error`, and a list of stricter rules on top, among them `noUnsafeTypeAssertion`, `useBlockStatements`, `noEqualsToNull`, `useNumericSeparators`, `useUnicodeRegex`, `useLiteralKeys`, `readonly T[]` arrays, `noFloatingPromises`, `noMisusedPromises`, `useExhaustiveSwitchCases`, `useExhaustiveDependencies`, `it` for every test, function declarations over function expressions, interfaces for object types, a cognitive complexity limit of 15, no nested ternaries, no barrel files and no `export *`.
- **Assist:** organized imports and sorted keys, attributes, enum members, interface members and properties. Keys are sorted in JSON and in object literals alike; `package.json` is left out.
- **Plugins:** GritQL rules that ban ambient time, randomness, `console` and `process.env` for Effect's services, and that ask `Effect.fn` for a literal span name shaped `Owner.operation`. They load from `./node_modules/@shivaedev/quality/biome/plugins`, so the package must be installed at the repository root.
- Files ignored by git are skipped.

The preset turns off `noUnusedVariables` and `noUnusedFunctionParameters`, because the tsconfig presets report them through TypeScript, and allows default exports in `*.config.*` files, which tools load through the default export. It declares these weakenings in its `declarations.json`, so `suppressions/biome-overrides` takes them as declared. Every other weakening a repository adds is an override it declares with a reason.

The `biome` rule runs `biome check` with the repository's config and reports each finding as `biome/<category>`, such as `biome/lint/style/useBlockStatements`, `biome/assist/source/useSortedKeys`, `biome/format` or `biome/plugin`, so Biome's findings go through the baseline like any other rule's. `adopt: ["biome"]` and `quality baseline write --rule biome` take in every Biome category at once. A finding below `error`, such as a rule a repository declared at `warn`, is not reported. The rule also asks for a root `biome.json` or `biome.jsonc` that extends the preset, and it takes no registry exceptions. A Biome config that Biome cannot load stops the run with Biome's message.

`quality fix` applies Biome's safe fixes, assist actions and formatting. An editor that runs Biome on save uses the same version when it resolves Biome from the root `node_modules`, so a repository that wants that installs `@biomejs/biome` at the version this package pins.

## Vitest projects

`@shivaedev/quality/vitest` sets up the tests of a package by file name, so no test file sets its environment with a pragma. It needs `vitest`, and `happy-dom` for DOM tests.

```ts
// vitest.config.ts
import { testProjects } from "@shivaedev/quality/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({ test: testProjects() });
```

| Project | Files | Environment | Runs |
| --- | --- | --- | --- |
| `unit` | `*.test.ts` and the other test files | Node | By default |
| `dom` | `*.dom.test.ts`, `*.dom.test.tsx` | happy-dom | By default |
| `slow` | `*.slow.test.ts`, `*.slow.test.tsx` | Node | Only with `vitest run --project slow` |

Type tests (`*.typecheck.test.ts` and `typecheck.test.ts`) are in no project: the compiler checks them. A test that is too slow for every run goes into the slow project instead of being skipped.

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

`pnpm ready` checks formatting, TypeScript 7, the rules, the import graph against seeded repositories and the fence policy against its examples, config, discovery, registry, baseline and report behavior, the command line against seeded repositories and git histories, the Biome preset against every rule Biome recommends and against its declarations, the `biome` rule and `quality fix` against seeded repositories, the Vitest projects against a seeded repository that Vitest runs, an installed tarball consumer that type-checks a config and runs the `quality` bin through a baseline that takes in the preset's lint and plugin findings, and installed consumers that extend each tsconfig preset, type-check a fixture with an expected error for each check the base turns on, and run the package preset's build output.
