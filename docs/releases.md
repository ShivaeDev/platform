# Package changes and releases

A consumer-visible change adds one `.changeset/<short-name>.md` per PR, naming each affected package and its explicit bump. Choose a descriptive short name unique to the PR. Internal refactors, tests, tooling and docs need no changeset. `CHANGELOG.md` holds released versions only.

```markdown
---
"@shivaedev/effect-react": minor
---

### Added

- Keep an editor's draft when its query refreshes.
```

Use minor for Added or Breaking behavior while a package is pre-1.0, and patch for Changed or Fixed only. Write Markdown bullets under `### Added`, `### Changed`, `### Fixed` or `### Breaking`. One file can name several packages and contain several entries and sections. Describe behavior a consumer would look for, within the tests that prove it. Do not change package versions, changelogs or release manifests outside a release PR.

## Release packages

The release PR (`release/next`) collects the pending release plan until its CI is approved. To release, press **Approve and run** on the PR, then merge when the normal, full CI is green. The workflow uses only `GITHUB_TOKEN`; the wait for a maintainer's approval is intentional.

Enable **Allow GitHub Actions to create pull requests** in Settings → Actions → General → Workflow permissions. After each push to main, the workflow regenerates the branch only when the applied release changes or the branch no longer merges cleanly. Unrelated main pushes leave the branch and its waiting CI run alone. It opens a missing PR and closes it when nothing is pending.

The workflow holds the branch and logs why when the release PR is in the merge queue, or its latest pull-request CI run on the current head is queued, running or successful. Changesets merged meanwhile stay on main for the next release. After the release merges, closes, or its CI fails or is cancelled, the next main push can regenerate the branch. Waiting for approval does not hold a release. Reading CI runs uses `GITHUB_TOKEN` with `actions: read`.

Merging the release PR changes package versions on main, which starts the existing publish workflow. Publishing still uses npm trusted publishing from main only. The release PR workflow has no npm credential or OIDC permission.

When released packages change starter pins, the automation includes a patch changeset for `@shivaedev/create-app` before applying the plan so generated apps receive those versions.

The repository uses the workspace `@shivaedev/changesets` package. To inspect or prepare a release locally:

1. Run `pnpm changesets plan` (or `pnpm changesets plan --json`) and review the requested bumps and automatic dependent releases.
2. When starter pins change, include a patch changeset for `@shivaedev/create-app` so generated apps receive the new versions.
3. Run `pnpm changesets apply` from the repository root. It bumps versions, collects changelogs, writes `.changeset/release.json` and deletes consumed changesets. The repository config hook aligns existing starter pins in `examples/starter/published-versions.json` and the released binaries' `packageInfo.ts` version constants.
4. Review and commit all generated files. Run `pnpm ready`, then open the pull request.

Published workspace dependents receive at least a patch transitively, including optional dependencies and peers. Private packages and development-only dependents do not receive automatic releases. Workspace wildcard declarations stay intact; exact, caret and tilde workspace references advance with the release. The plan and collected inputs remain reviewable in `.changeset/release.json` after a squash merge. Existing changelog history stays unchanged.

`pnpm changelog:check [base-ref]` validates pending changesets and the release diff. It uses `CHANGELOG_BASE_REF` when set; otherwise the package defaults to `origin/main`, falling back to local `main`. Fetch full history or pass a known base if neither exists. It rejects package-local `packages/*/changes/*.md` fragments with a message pointing to `.changeset/`, direct changelog edits without a version bump, altered release inputs, retained consumed changesets, missing dependent releases and edits to released history. Lint and the commit hook run this check. PR CI uses the checked PR base, the merge queue uses its base revision, and publishing checks against the revision before the push before shipping versions not yet on npm.

The check also requires starter pins to match the current workspace versions and include each pinned package's published framework dependencies. Align the dependency releases and starter pins, and include a patch changeset for `@shivaedev/create-app` when those pins change.

Hooks run after collection. If a hook fails, review or restore the generated release diff before retrying. See the [Changesets package](../packages/changesets/README.md) for its input format, plan and validation rules.
