# @shivaedev/changesets

Turn explicit change notes into a reproducible workspace release. See every version bump, include published dependents, and check the collected notes against their original inputs after a squash merge.

## One plan for the release

Authors record the packages and bumps they intend. The release tool carries that intent through versions and grouped changelogs.

```markdown
---
"@acme/core": minor
"@acme/client": patch
---

### Added

- Keep a draft when its query refreshes.
```

```text
@acme/client: 0.4.0 -> 0.4.1 (patch)
@acme/core: 0.2.3 -> 0.3.0 (minor)
```

## Use changesets

Put changes in one repository-root `.changeset/` directory, with a unique `.md` filename per change. Frontmatter is a flat YAML mapping from package names to explicit `patch`, `minor` or `major` bumps; quoted and bare scalars and comments are supported. One file can name several packages. Under the frontmatter, write Markdown list entries beneath `### Added`, `### Changed`, `### Fixed` or `### Breaking`. Indented continuation lines belong to the preceding entry. `README.md` is reserved for directory instructions.

The planner takes the highest requested bump for each package. Every published workspace dependent receives at least a patch, transitively, through dependencies, optional dependencies and peers. Private and development-only dependents do not receive an automatic release. A `major` bump on a `0.x` version fails: use `minor` for breaking changes before 1.0. Package versions must be stable `major.minor.patch` versions.

### Configure the repository

By default, package directories are `packages/*` and `examples/*`. Override them in `.changeset/changesets.config.ts` with relative directory paths or `parent/*` patterns. Hooks receive the release plan and run after collection. They are Effect functions with filesystem access and typed `ChangesetError` or platform failures.

```ts
import { Effect, FileSystem } from "effect";
import { defineConfig } from "@shivaedev/changesets/config.ts";

export default defineConfig({
  packages: ["packages/*"],
  hooks: [({ root, plan }) => Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const versions = Object.fromEntries(plan.releases.map(release => [release.name, release.to]));
    yield* fs.writeFileString(`${root}/published-versions.json`, JSON.stringify(versions));
  })],
});
```

### Plan, apply and check

```sh
changesets plan
changesets plan --json
changesets apply
changesets check origin/main
```

`plan --json` prints the typed `ReleasePlan`: the exact changeset filenames and text, plus each release's name, directory, previous version, next version and bump. The default output is a human summary. Planning does not write files.

`apply` computes the current plan, bumps `package.json` versions, prepends changelog entries dated in UTC, writes `.changeset/release.json`, deletes consumed files and runs hooks in order. Changelog sections use Added, Changed, Fixed, Breaking order, with changesets sorted by filename. Dependents without their own entries receive a dependency release note. Workspace wildcard dependency declarations remain intact; exact, caret and tilde references to released workspace packages advance to their next versions. Other range forms require an explicit supported declaration before applying. An empty plan writes nothing.

`check [base-ref]` checks pending files and the diff from the merge base with `HEAD`. Its default base is `origin/main`, falling back to `main`. Fetch history or pass a known base when neither exists. The release manifest records all inputs, including changesets added and consumed within the same diff. Validation reproduces the plan and changelogs, rejects changed release inputs, retained consumed files, missing dependents, changes to released history and changelog edits without a bump. Changesets outside the manifest remain pending and must remain unchanged if they existed at the base. Keep the manifest in version control.

Hook failures are returned through Effect; collection has already written its files at that point. Review or restore the release diff before retrying after a hook failure.

### Effect API

Import `planRelease(root, config?)` and `summarizePlan(plan)` from `@shivaedev/changesets/planner.ts`, `applyRelease(root, config?)` from `/applyRelease.ts`, and `checkRepository(root, config?, baseRef?)` from `/check.ts`. Provide `FileSystem.FileSystem` to the filesystem operations. `/model.ts` defines the plan schemas and types; `/error.ts` defines `ChangesetError`. `@shivaedev/changesets/parser.ts` exports the pure `parseChangeset({ name, text })` parser. The CLI loads `.changeset/changesets.config.ts`; callers of the Effect API pass config directly.

Install with `pnpm add -D @shivaedev/changesets effect @effect/platform-node @effect/platform-node-shared`. Node.js 24 or later runs the CLI and TypeScript config. Publishing remains the repository's job.
