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
import { noTodo } from "./quality/no-todo.ts";

export default defineConfig({
	sources: ["src", "scripts"],
	exclude: ["src/components/ui/", "*.gen.ts"],
	local: [noTodo],
	rules: {
		"structure/max-lines": { options: { source: 200, testFiles: ["e2e/"] } },
		"local/no-todo": "warn",
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

### Local rules

```ts
import { defineRule } from "@shivaedev/quality";

export const noTodo = defineRule({
	id: "local/no-todo",
	description: "Resolve TODOs before merging.",
	check: ({ sources }) =>
		sources.flatMap((file) =>
			file.lines.flatMap((text, index) => (text.includes("TODO") ? [{ file: file.path, line: index + 1, message: "Resolve this TODO." }] : [])),
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
	"local/no-todo": {
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

`pnpm ready` checks formatting, both TypeScript compilers, the rule, config, discovery, registry, baseline and report behavior, the command line against seeded repositories, and an installed tarball consumer that type-checks a config and runs the `quality` bin through a baseline cycle.
