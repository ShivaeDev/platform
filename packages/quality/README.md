# @shivaedev/quality

One quality gate for a repository: typed rules, one report, a baseline that only shrinks and a registry of permanent exceptions, each with its reason.

Every rule is an error by default. A repository adopts the gate at once: it records its existing violations in the baseline, and from then on a baselined file may not get worse, and fixed debt must leave the baseline.

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
| `baseline` | `quality/baseline.json` | Existing violations that may only shrink. |
| `local` | `[]` | The repository's own rules, made with `defineRule`. |
| `rules` | every rule at `error` | A level per rule id, or `{ level, options }`. |

The config is typed: an unknown rule id, a misspelled option or an option of the wrong type fails to compile. It is also validated when loaded, so a JavaScript config gets the same checks.

## Levels

- `error` is the default. An error-level violation that the baseline and the registry do not cover fails the gate.
- `warn` reports without failing. It exists for the transition to a new rule and is meant to be temporary: move the rule to `error` and baseline what is left.
- `off` disables the rule.

## Rules

`structure/max-lines` keeps each module to one job: a source file may have 150 lines and a test file 300, counted the way an editor numbers them. Declaration files are exempt. Its options are `source` and `test` (the limits) and `testFiles`, `.gitignore` patterns that mark test files (`*.test.*`, `*.spec.*`, `test/`, `tests/` and `__tests__/` by default). A violation's measure is the file's line count, so a baselined file may shrink but never grow.

### Comments

A comment says why, never what the code already says or what it used to be. Six rules hold every comment to that:

| Rule | Reports | Options |
| --- | --- | --- |
| `comments/no-jsdoc` | Every `/** */` block, except a tool pragma | `allow` |
| `comments/no-line-reference` | A line number: `file.ts:42`, `file.ts#L42`, `line 42` | none |
| `comments/no-pr-reference` | A pull request or issue: `#123`, `PR 123`, `MR 123`, `pull request 123`, `merge request 123`, `issue 123`, `ticket 123`, `/pull/123`, `/issues/123`, `/merge_requests/123`, `GH-123` | none |
| `comments/no-banner` | A banner, divider or region: a line that starts or ends with three or more of `- = * # ~ _ + / \ ─ ━ ═ ┄ ┈`, `#region`, `#endregion` | none |
| `comments/no-todo` | `TODO`, `FIXME`, `XXX` and `@todo` | none |
| `comments/max-per-file` | A file with more than `max` comments, 2 by default | `max`, `allow` |

The rules find comments with the TypeScript parser, so text inside strings, template literals, regular expressions and JSX never counts as a comment. They read the TypeScript and JavaScript modules among the sources and skip declaration files. Each finding names the line its comment starts on.

`comments/max-per-file` counts comments this way:

- A block comment counts once, however many lines it spans.
- Line comments that each stand alone on adjacent lines form one run and count once. A blank line, code, a directive, or a comment after code on the same line starts a new one.
- Tool pragmas and directives are not counted: compiler and linter directives (`@ts-…`, triple-slash directives such as `/// <reference …>`, `biome-ignore…`, `eslint-disable…`, `eslint-enable…`, `prettier-ignore`), bundler annotations (`#__PURE__`, `@__PURE__`, `#__NO_SIDE_EFFECTS__`, `@__NO_SIDE_EFFECTS__`) and coverage hints (`c8 ignore`, `v8 ignore`, `istanbul ignore`).

The other comment rules skip directives too. Its measure is the count, so a baselined file may lose comments but never gain one. A finding names the first comment over the limit.

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

`check` receives the repository `root`, every checked path in `files`, the `sources` with their `text` and `lines`, `readText(path)` for any other file (undefined when absent) and the validated `options`. It returns findings, or a promise of them. A finding names its `file`, relative to the root (an absolute path under it is made relative), and its `message`, and optionally a `line`, a `subject` that tells apart exceptions of one rule in one file, and a `measure` where larger is worse.

A rule with options declares them with any [Standard Schema](https://standardschema.dev), such as `Schema.toStandardSchemaV1(...)` from Effect. Options are an object: when the config gives none, the schema validates `{}`, so give each option a default or make it optional. A rule without an options schema refuses options.

## Baseline

```json
{
	"structure/max-lines": {
		"src/server/db.ts": {
			"count": 1,
			"measure": 412
		}
	},
	"comments/no-jsdoc": {
		"src/legacy/sync.ts": {
			"count": 3
		}
	}
}
```

Each entry covers the violations of one rule in one file. The gate fails when a baselined file has more violations than its `count`, or a larger measure than its `measure`; the report then lists all of that file's violations for the rule. It also fails when an entry allows more than is left, including a file with no violations left and a rule that is off or unknown. The baseline covers violations at any level.

- `quality baseline write` records every error-level violation when there is no baseline yet. Once a baseline exists it refuses, unless `--rule <id>` names rules the baseline does not cover yet: that is how a rule is adopted later. It never raises an entry.
- `quality baseline prune` drops fixed debt and lowers entries to what is left. It never adds or raises an entry.

The file keeps the indentation it has, and its rules and files are sorted, so its diffs stay small.

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

An entry covers a rule's violations in one file, for good, and must say why. With a `subject`, it covers only the violations with that subject. The registry applies before the baseline. An entry that covers nothing, or names a rule that is off or unknown, fails the gate until it is removed.

## Command line

```text
quality lint [--config <file>] [--warnings summary|all]
quality baseline write [--config <file>] [--rule <id>]...
quality baseline prune [--config <file>]
```

`quality` alone runs `lint`. The report groups violations by rule and states each rule's description once; warnings are summarized per rule with the files that have the most, and `--warnings all` lists each one.

| Exit code | Meaning |
| --- | --- |
| 0 | Passed. Warnings may remain. |
| 1 | Failed: an uncovered error-level violation, a baselined file that got worse, or a stale baseline or registry entry. |
| 2 | Could not run: no or invalid config, an invalid baseline or registry, a missing source, a rule that threw, or a usage error. |

## Validation

`pnpm ready` checks formatting, both TypeScript compilers, the rules, config, discovery, registry, baseline and report behavior, the command line against seeded repositories, and an installed tarball consumer that type-checks a config and runs the `quality` bin through a baseline cycle.
