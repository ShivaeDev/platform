# Package changes and releases

A consumer-visible change adds one `.changeset/<short-name>.md` per PR, naming each affected package and its explicit bump. Choose a descriptive short name unique to the PR. Internal refactors, tests, tooling and docs need no changeset. `CHANGELOG.md` holds released versions only.

```markdown
---
"@shivaedev/effect-react": minor
---

### Added

- Keep an editor's draft when its query refreshes.
```

Use minor for Added or Breaking behavior while a package is pre-1.0, and patch for Changed or Fixed only. Write Markdown bullets under `### Added`, `### Changed`, `### Fixed` or `### Breaking`. One file can name several packages and contain several entries and sections. Describe behavior a consumer would look for, within the tests that prove it. Do not change package versions or changelogs outside a release PR.

## Rename or remove packages

To rename a package, change its manifest name and add a changeset naming the new package with its bump. Under `### Breaking`, name the old package and explain the dependency and import changes consumers need:

```markdown
---
"@shivaedev/new-name": minor
---

### Breaking

- Rename `@shivaedev/old-name` to `@shivaedev/new-name`; change dependency declarations and imports to the new name.
```

Keep the existing version and released changelog history when renaming in the same directory. The release plan advances the new name and leaves the old npm name alone; it does not publish or deprecate it. Release collection prepends notes without changing the old entries.

To remove a package, name a remaining package and its bump in the changeset frontmatter. Add a `### Breaking` entry naming the removed package and explaining its replacement or migration steps. Do not put the removed name in frontmatter. The check rejects an undeclared disappearance and explains how to declare it; removed packages do not enter the release plan. Keep declarations pending until the release consumes them normally.

## Release packages

The release PR (`release/next`) collects the pending release plan until its CI is approved. To release, press **Approve and run** on the PR, then merge when the normal, full CI is green. The workflow uses only `GITHUB_TOKEN`; the wait for a maintainer's approval is intentional.

Enable **Allow GitHub Actions to create pull requests** in Settings → Actions → General → Workflow permissions. After each push to main, the workflow regenerates the branch only when the applied release changes or the branch no longer merges cleanly. Unrelated main pushes leave the branch and its waiting CI run alone. It opens a missing PR and closes it when nothing is pending.

The workflow holds the branch and logs why when the release PR is in the merge queue, or the branch merges cleanly with main and its latest pull-request CI run on the current head is queued, running or successful. A conflicting branch is regenerated even after CI succeeds, unless it is in the merge queue. Changesets merged during a hold stay on main for the next release. After the release merges, closes, or its CI fails or is cancelled, the next main push can regenerate the branch. Waiting for approval does not hold a release. Reading CI runs uses `GITHUB_TOKEN` with `actions: read`.

Merging the release PR changes package versions on main, which starts the existing publish workflow. Publishing still uses npm trusted publishing from main only. The release PR workflow has no npm credential or OIDC permission.

When released packages change starter pins, the automation derives a patch changeset for `@shivaedev/create-app` before applying the plan so generated apps receive those versions. The check reconstructs only that canonical starter-pin input; all other consumed inputs must be changesets deleted since the base. Altering its generated notes fails validation.

The repository uses the workspace `@shivaedev/changesets` package. To inspect or prepare a release locally:

1. Run `pnpm changesets plan` (or `pnpm changesets plan --json`) and review the requested bumps and automatic dependent releases.
2. Use the automated release PR when starter pins change; it derives the `@shivaedev/create-app` patch automatically.
3. Run `pnpm changesets apply` from the repository root. It bumps versions, collects changelogs and deletes consumed changesets. The repository config hook aligns existing starter pins in `examples/starter/published-versions.json` and the released binaries' `packageInfo.ts` version constants.
4. Review and commit all generated files. Run `pnpm ready`, then open the pull request.

Published workspace dependents receive at least a patch transitively, including optional dependencies and peers. Private packages and development-only dependents do not receive automatic releases. Workspace wildcard declarations stay intact; exact, caret and tilde workspace references advance with the release. After a squash merge, the version diff, deleted changesets and changelogs still show the release plan and collected inputs. Existing changelog history stays unchanged.

`pnpm changelog:check [base-ref]` validates pending changesets and the release diff. It uses `CHANGELOG_BASE_REF` when set; otherwise the package defaults to `origin/main`, falling back to local `main`. Fetch full history or pass a known base if neither exists. It rejects package-local `packages/*/changes/*.md` fragments with a message pointing to `.changeset/`, direct changelog edits without a version bump, altered release inputs, retained consumed changesets, missing dependent releases and edits to released history. Lint and the commit hook run this check. PR CI uses the checked PR base, the merge queue uses its base revision, and publishing checks against the revision before the push before shipping versions not yet on npm.

The check also requires starter pins to match the current workspace versions and include each pinned package's published framework dependencies. Align the dependency releases and starter pins; the automated release PR derives the `@shivaedev/create-app` patch when those pins change.

Hooks run after collection. If a hook fails, review or restore the generated release diff before retrying. See the [Changesets package](../packages/changesets/README.md) for its input format, plan and validation rules.
