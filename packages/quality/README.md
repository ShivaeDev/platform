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

A comment says why, never what the code already says or what it used to be. Six rules hold every comment to that:

| Rule | Reports | Options |
| --- | --- | --- |
| `comments/no-jsdoc` | Every `/** */` block, except a tool pragma | `allow` |
| `comments/no-line-reference` | A line number: `file.ts:42`, `file.ts#L42`, `line 42` | none |
| `comments/no-pr-reference` | A pull request or issue: `#123`, `PR 123`, `MR 123`, `pull request 123`, `merge request 123`, `issue 123`, `ticket 123`, `/pull/123`, `/pulls/123`, `/issues/123`, `/merge_requests/123`, `GH-123` | none |
| `comments/no-banner` | A banner, divider or region: a line that starts or ends with three or more of `- = * # ~ _ + / \ ─ ━ ═ ┄ ┈`, `#region`, `#endregion` | none |
| `comments/no-todo` | `TODO`, `FIXME`, `XXX` and `@todo` | none |
| `comments/max-per-file` | A file with more than `max` comments, 2 by default | `max`, `allow` |

The rules find comments with the TypeScript parser, so text inside strings, template literals, regular expressions and JSX never counts as a comment. They read the TypeScript and JavaScript modules among the sources and skip declaration files and the directives listed below. Each finding names the line its comment starts on.

`comments/max-per-file` counts comments this way:

- A block comment counts once, however many lines it spans.
- Line comments that each stand alone on adjacent lines form one run and count once. A blank line, code, a directive, or a comment after code on the same line starts a new one.
- Tool pragmas and directives are not counted: compiler and linter directives (`@ts-…`, triple-slash directives such as `/// <reference …>`, `biome-ignore…`, `eslint-disable…`, `eslint-enable…`, `oxlint-…`, `stylelint-…`, `deno-lint-ignore…`, `tslint:disable…`, `prettier-ignore`, Flow's `$FlowFixMe`, `$FlowIgnore`, `$FlowExpectedError`, `$FlowIssue` and `@noflow`), bundler annotations (`#__PURE__`, `@__PURE__`, `#__NO_SIDE_EFFECTS__`, `@__NO_SIDE_EFFECTS__`) and coverage hints (`c8 ignore`, `v8 ignore`, `istanbul ignore`). The suppression rules below report the directives that silence a check.

A file over the limit counts one violation for each comment above it: 5 comments against a limit of 2 count 3. A finding names the first comment over the limit.

A tool pragma is a comment whose every line starts with an allowed tag, such as `/** @vitest-environment happy-dom */`. `allow` lists the tags and defaults to `@vitest-environment`, `@vitest-environment-options`, `@jest-environment`, `@jsx`, `@jsxFrag`, `@jsxImportSource` and `@jsxRuntime`. A list given replaces the default, and `comments/no-jsdoc` and `comments/max-per-file` each take their own, so give both the same list:

```ts
const pragmas = ["@vitest-environment", "@license"];

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
| `suppressions/no-inline` | Every comment directive that silences a linter, the compiler or a formatter, except a declared `@ts-expect-error` | `declared` |
| `suppressions/no-double-cast` | A cast through `unknown`, `any` or `never`: `x as unknown as T`, `x as any as T`, `x as never as T`, `<T><unknown>x` | none |
| `suppressions/biome-overrides` | A Biome setting that turns a check off or down, or keeps files out of it, without a declaration, and a declaration that matches no setting | `declared` |

`suppressions/no-inline` reports these directives, wherever a line of a comment starts with one:

- Biome: `biome-ignore`, `biome-ignore-all` and `biome-ignore-start`, for lint, assist and format alike. The `biome-ignore-end` that closes a range is not reported again.
- TypeScript: `@ts-ignore`, `@ts-expect-error` and `@ts-nocheck`. `@ts-check` turns checking on and is allowed.
- Other linters: `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line` and inline rule settings such as `/* eslint no-console: "off" */`; the same `-disable` forms of `oxlint` and `stylelint`; `deno-lint-ignore` and `deno-lint-ignore-file`; `tslint:disable…`.
- Formatters: `prettier-ignore`, since `prettier --check` fails on the code it skips.
- Flow: `$FlowFixMe`, `$FlowIgnore`, `$FlowExpectedError`, `$FlowIssue` and `@noflow`.

Coverage hints (`c8 ignore`, `v8 ignore`, `istanbul ignore`) are allowed: they leave code out of a coverage measure and silence no linter or compiler. The rule reads the TypeScript and JavaScript modules among the sources, declaration files included, and every `.css`, `.scss` and `.less` file among the checked files, whatever `extensions` says. Each finding names the line its comment starts on and has the directive as its subject.

#### Declared type tests

A type test proves that an API rejects what its types forbid, and TypeScript asserts a compile error only through `@ts-expect-error`, which fails as soon as the error it expects goes away. So `@ts-expect-error`, and no other directive, may be declared for a set of files:

```ts
export default defineConfig({
	rules: {
		"suppressions/no-inline": {
			options: {
				declared: [
					{
						directive: "@ts-expect-error",
						includes: ["*.typecheck.ts"],
						reason: "Type tests assert the compile errors the public types must raise.",
					},
				],
			},
		},
	},
});
```

`includes` takes `.gitignore` patterns, like `exclude`. `@ts-ignore`, `@ts-nocheck` and every linter and formatter directive stay reported in those files. A declaration that matches no `@ts-expect-error` is reported against `quality.config.ts` until it is removed. A test that must pass a rejected value at run time, to prove the runtime refuses it too, calls the API through `Reflect.apply` instead of a directive.

`suppressions/no-double-cast` finds casts with the TypeScript parser, through parentheses and in either assertion syntax. A single cast is left to the linter, and `as const` is not a cast.

#### Declared Biome overrides

A scope that truly cannot follow a lint rule keeps its exception in the Biome config, and the quality config declares it with a reason. `suppressions/biome-overrides` reads `biome.json` or `biome.jsonc` at the root, every nested `biome.json` and `biome.jsonc` among the checked files, and the local files a config `extends` (an entry that starts with `.`). These settings count as overrides, at the top level and in every `overrides` entry:

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

## Validation

`pnpm ready` checks formatting, both TypeScript compilers, the rules, config, discovery, registry, baseline and report behavior, the command line against seeded repositories and git histories, and an installed tarball consumer that type-checks a config and runs the `quality` bin through a baseline cycle.
