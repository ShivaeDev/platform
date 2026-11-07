# Package changes and releases

A consumer-visible change adds one `.changeset/<short-name>.md` per PR, naming each affected package and its explicit bump. Choose a descriptive short name unique to the PR. Internal refactors, tests, tooling and docs need no changeset. `CHANGELOG.md` holds released versions only.

```markdown
---

"@shivaedev/react": minor

---

### Added

- Keep an editor's draft when its query refreshes.
```

Use minor for Added or Breaking behavior while a package is pre-1.0, and patch for Changed or Fixed only. Write Markdown bullets under `### Added`, `### Changed`, `### Fixed` or `### Breaking`. One file can name several packages and contain several entries and sections. Describe behavior a consumer would look for, within the tests that prove it. Do not change package versions or changelogs outside a release PR.

When frontmatter names several packages, attribute every bullet to exactly one of them with a backticked package name and a colon. The attribution is removed from the rendered notes; each package receives only its own bullets, including their indented continuations. Single-package changesets can keep plain bullets.

```markdown
---

"@shivaedev/releases": minor
"@shivaedev/react": patch
---

### Added

- `@shivaedev/releases`: Collect each package's attributed release notes.

### Fixed

- `@shivaedev/react`: Keep the editor draft during refresh.
```

`pnpm changelog:check` rejects unattributed bullets and names the changeset file. Existing pending changesets may gain attribution while keeping their frontmatter and bullet wording unchanged. Once attributed, pending bullets cannot change owners. Released history remains unchanged.

## Rename or remove packages

To rename a package, change its manifest name and add a changeset naming the new package with its bump. Under `### Breaking`, name the old package and explain the dependency and import changes consumers need:

```markdown
---

"@shivaedev/new-name": minor

---

### Breaking

- Rename `@shivaedev/old-name` to `@shivaedev/new-name`; change dependency declarations and imports to the new name.
```

A declared rename may also move the package folder. Keep the existing version and move its `CHANGELOG.md` with its released history unchanged. The check follows the `Rename` entry to the previous package even when its folder changes. The release plan advances the new name and leaves the old npm name alone; it does not publish or deprecate it. Release collection prepends notes without changing the old entries.

To remove a package, name a remaining package and its bump in the changeset frontmatter. Add a `### Breaking` entry naming the removed package and explaining its replacement or migration steps. Do not put the removed name in frontmatter. The check rejects an undeclared disappearance and explains how to declare it; removed packages do not enter the release plan. Keep declarations pending until the release consumes them normally.

## Release packages

The release PR (`release/next`) collects the pending release plan. To release, press **Approve and run** on the PR, then merge when the normal, full CI is green. The workflow uses only `GITHUB_TOKEN`; the wait for a maintainer's approval is intentional.

Enable **Allow GitHub Actions to create pull requests** in Settings → Actions → General → Workflow permissions. After each push to main, the workflow regenerates an unapproved branch when its applied release changes or it no longer merges cleanly. Repeated runs without new main commits leave the branch and its waiting CI run alone. It opens a missing PR and closes it when nothing is pending.

Approving the release CI freezes the release while it still passes release validation against current main. Before holding a branch in the merge queue, or one whose latest pull-request CI run on the current head is queued, running or successful, the workflow checks a temporary merge with main. A merge conflict or failed release validation regenerates the same PR from current main, including its pending changesets; the new head needs **Approve and run** and green CI again. This includes later dependency changes that would require different package versions. A valid release stays frozen after unrelated main commits or later changesets, which stay pending for the next release PR. After the release merges, closes, or its CI fails or is cancelled, the next maintainer run can regenerate the branch. Waiting for approval does not hold a release. Reading CI runs uses `GITHUB_TOKEN` with `actions: read`.

The release PR records its base revision in `.changeset/release-base`. The merge-queue and publishing checks accept pending changesets absent at that revision only when they are present, unchanged, on the checked main revision. They remain in `.changeset` for the next release. A release still cannot drop or rewrite its original changesets or their collected notes. Commit the recorded base with the generated release files so this boundary survives a squash merge.

After each push to main, publishing compares workspace package versions at the revisions before and after the push. A version increase selects that public package at its new version, including when the push batches a release merge with other commits. This decision uses only Git data, with no GitHub PR lookup or npm query. It relies on `changelog:check` enforcing version changes through release PRs. A push without version increases publishes nothing, even when npm is missing a workspace version.

Publishing validates, builds and checks packed consumers from the pushed main commit. It publishes exactly the public workspace packages whose versions increased in the push. Versions already on npm are skipped, so the same push can be rerun safely. Older missing versions outside the push diff are left alone. The publish summary selects the versions for GitHub release notes, taken from their existing changelog sections without changing released history or bumping versions again. GitHub release notes and tags target the published main commit.

Publishing uses npm trusted publishing from main only. The workflow preserves GitHub's original OIDC environment, including `GITHUB_SHA`, so provenance verification matches the workflow identity and published commit. The release PR workflow has no npm credential or OIDC permission.

The Platform release-PR planner compares each public package’s Effect requirements in dependencies, optional dependencies and peers with the manifest of its current version on npm. Catalog references resolve to the workspace’s exact pins. Packages with drift receive a generated patch changeset unless the plan already releases them. This lets Renovate merge Effect catalog bumps without handwritten changesets. Private packages and development-only requirements do not enter this comparison. Workspace versions not yet on npm wait for the publish workflow; other registry errors fail planning.

When released packages change starter pins, the automation derives a patch changeset for `@shivaedev/create-app` before applying the plan so generated apps receive those versions. Release validation reconstructs the canonical framework-version and starter-pin inputs; all other consumed inputs must be changesets deleted since the base. Framework comparison reads immutable npm versions and needs registry access during release planning and validation of version changes. Ordinary pending-changeset checks do not query npm. Altering generated notes fails validation.

The repository uses the workspace `@shivaedev/releases` package. To inspect or prepare a release locally:
1. Run `pnpm releases plan` (or `pnpm releases plan --json`) and review the requested bumps and automatic dependent releases.
2. Use the automated release PR when starter pins change; it derives the `@shivaedev/create-app` patch automatically.
3. Run `pnpm releases apply` from the repository root. It bumps versions, collects changelogs and deletes consumed changesets. The repository config hook aligns existing starter pins in `examples/starter/published-versions.json`.
4. Review and commit all generated files. Run focused tests with `pnpm --filter <package> test <paths>` and the root `pnpm ready` fast static gate (Biome lint and format checks, repository rules, the changelog check and typechecking), then open the pull request. CI runs the full test suite, builds and package archive checks across its shards.

Published workspace dependents receive at least a patch transitively, including optional dependencies and peers. Private packages and development-only dependents do not receive automatic releases. Workspace wildcard declarations stay intact; exact, caret and tilde workspace references advance with the release. After a squash merge, the version diff, deleted changesets and changelogs still show the release plan and collected inputs. Existing changelog history stays unchanged.

`pnpm changelog:check [base-ref]` validates pending changesets and the release diff. It uses `CHANGELOG_BASE_REF` when set; otherwise the package defaults to `origin/main`, falling back to local `main`. Fetch full history or pass a known base if neither exists. It rejects package-local `packages/*/changes/*.md` fragments with a message pointing to `.changeset/`, direct changelog edits without a version bump, altered release inputs, retained consumed changesets, missing dependent releases and edits to released history. Lint and the commit hook run this check. PR CI uses the checked PR base, the merge queue uses its base revision, and publishing checks merged main against the revision before the push before shipping versions not yet on npm.

The check also requires starter pins to match the current workspace versions and include each pinned package's published framework dependencies. Align the dependency releases and starter pins; the automated release PR derives the `@shivaedev/create-app` patch when those pins change.

Hooks run after collection. If a hook fails, review or restore the generated release diff before retrying. See the [releases package](../packages/releases/README.md) for its input format, plan and validation rules.
