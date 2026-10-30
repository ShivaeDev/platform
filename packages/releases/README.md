# @shivaedev/releases

Turn explicit change notes into a reproducible workspace release. See every version bump, include published dependents, and check the collected notes against their original inputs after a squash merge.

## One plan for the release

Authors record the packages and bumps they intend. The release tool carries that intent through versions and grouped changelogs.

```markdown
---

"@acme/core": minor
"@acme/client": minor
---

### Added

- Keep a draft when its query refreshes.
```

```text
@acme/client: 0.4.0 -> 0.5.0 (minor)
@acme/core: 0.2.3 -> 0.3.0 (minor)
```

## Use changesets

Put changes in one repository-root `.changeset/` directory, with a unique `.md` filename per change. Frontmatter is a flat YAML mapping from package names to explicit `patch`, `minor` or `major` bumps; quoted and bare scalars and comments are supported. One file can name several packages. Under the frontmatter, write Markdown list entries beneath `### Added`, `### Changed`, `### Fixed` or `### Breaking`. Indented continuation lines belong to the preceding entry. `README.md` is reserved for directory instructions.

The planner validates each named package's bump in each fragment before combining requests. Before 1.0, Added or Breaking entries require at least `minor`; Changed or Fixed entries alone allow `patch`. An insufficient bump fails with the fragment name, package, declared bump and required bump, even when another fragment requests a larger bump for the same package.

The planner takes the highest requested bump for each package. Every published workspace dependent receives at least a patch, transitively, through dependencies, optional dependencies and peers. Private and development-only dependents do not receive an automatic release. A `major` bump on a `0.x` version fails with the fragment name: use `minor` for breaking changes before 1.0. Package versions must be stable `major.minor.patch` versions.

### Rename or remove a package

For a rename, change the manifest's name and declare the new name with its bump in changeset frontmatter. Add a `### Breaking` entry naming the old package and telling consumers how to migrate:

```markdown
---

## "@acme/new-name": minor

### Breaking

- Rename `@acme/old-name` to `@acme/new-name`; change dependency declarations and imports to the new name.
```

A declared rename may also move the package folder. Keep the existing version and move its `CHANGELOG.md` with its released history unchanged. The check follows the `Rename` entry to the previous package even when its folder changes. The release advances that version under the new name and prepends its notes without rewriting old entries. The plan releases the new name only; it does not publish or deprecate the old name.

For a removal, name a remaining package and its bump in frontmatter, and add a `### Breaking` entry naming the removed package and its replacement or migration steps. The removed name belongs in the note, never in frontmatter. Removed packages are excluded from release planning. A package disappearing without this declaration fails the diff check with instructions for adding it. Declarations may be pending or consumed by the release; consumed inputs must already exist at the base, just like other release inputs.

### Configure the repository

By default, package directories are `packages/*` and `examples/*`. Override them in `.changeset/changesets.config.ts` with relative directory paths or `parent/*` patterns. Hooks receive the release plan and run after collection. They are Effect functions with filesystem access and typed `ChangesetError` or platform failures.

```ts
import { Effect, FileSystem } from "effect";
import { defineConfig } from "@shivaedev/releases/config.ts";

export default defineConfig({
	packages: ["packages/*"],
	hooks: [
		({ root, plan }) =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const versions = Object.fromEntries(plan.releases.map((release) => [release.name, release.to]));
				yield* fs.writeFileString(`${root}/published-versions.json`, JSON.stringify(versions));
			}),
	],
});
```

### Plan, apply and check

```sh
releases plan
releases plan --json
releases apply
releases check origin/main
```

`plan --json` prints the typed `ReleasePlan`: the exact changeset filenames and text, plus each release's name, directory, previous version, next version and bump. The default output is a human summary. Planning does not write files.

`apply` computes the current plan, bumps `package.json` versions, prepends changelog entries dated in UTC, deletes consumed files and runs hooks in order. Changelog sections use Added, Changed, Fixed, Breaking order, with changesets sorted by filename. Dependents without their own entries receive a dependency release note. Workspace wildcard dependency declarations remain intact; exact, caret and tilde references to released workspace packages advance to their next versions. Other range forms require an explicit supported declaration before applying. An empty plan writes nothing.

`check [base-ref]` checks pending files and the diff from the merge base with `HEAD`. Its default base is `origin/main`, falling back to `main`. Fetch history or pass a known base when neither exists. Validation derives the plan from the base packages and changesets deleted since the base, and compares the complete generated changelogs, including released history. It rejects changed pending inputs, retained consumed files, missing dependents, incorrect versions and changelog edits without a bump. All new release headings must use the same valid UTC `YYYY-MM-DD` date. Changesets added after the base remain pending.

A new package starts at `0.0.0`; when its first release adds the package in the same diff, the check computes its bump from that placeholder. Its consumed changeset must already exist at the base.

Hook failures are returned through Effect; collection has already written its files at that point. Review or restore the release diff before retrying after a hook failure.

### Effect API

Import `planRelease(root, config?)` and `summarizePlan(plan)` from `@shivaedev/releases/planner.ts`, `applyRelease(root, config?)` from `/applyRelease.ts`, and `checkRepository(root, config?, baseRef?)` from `/check.ts`. Provide `FileSystem.FileSystem` to the filesystem operations. `/model.ts` defines the plan schemas and types; `/error.ts` defines `ChangesetError`. `@shivaedev/releases/parser.ts` exports the pure `parseChangeset({ name, text })` parser. The CLI loads `.changeset/changesets.config.ts`; callers of the Effect API pass config directly.

Install with `pnpm add -D @shivaedev/releases effect @effect/platform-node @effect/platform-node-shared`. Node.js 24 or later runs the CLI and TypeScript config. Publishing remains the repository's job.
