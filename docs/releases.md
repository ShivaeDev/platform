# Package changes and releases

A consumer-visible change adds one new `packages/<package>/changes/<short-name>.md` file per pull request. Choose a descriptive short name unique to the PR. Internal refactors, tests, tooling and docs need no fragment. Pending entries live in fragments; `CHANGELOG.md` holds released versions only.

```markdown
### Added

- Keep an editor's draft when its query refreshes.
```

Use `### Added`, `### Changed`, `### Fixed` or `### Breaking` with Markdown bullet entries. One fragment can include multiple entries and sections for the same PR. Describe behavior a consumer would look for, and keep claims within the tests that prove them. Two PRs add separate files, so their pending release notes do not share an edit.

## Release a package

Cut a release whenever a change needs to reach npm. In the release pull request:

1. Bump `packages/<package>/package.json`: a minor version for new or breaking behavior while the package is pre-1.0, a patch otherwise.
2. Run `pnpm run changelog:release <package>` from the repository root, for example `pnpm run changelog:release effect-sql`.
3. Review and commit the generated `CHANGELOG.md`, `release.json` and the deleted fragment files with the version bump.
4. Run `pnpm ready`, then open the pull request.

A create-app release also needs current framework pins in `examples/starter/published-versions.json`. Run `node --conditions=source script/checkTemplateVersions.ts` to compare every pin with npm's `latest` version. The publish workflow adds `--release` to check whenever the create-app version is not on npm yet, including retries, and stops the release on a mismatch or a registry failure.

The collector uses the package's version and the current UTC date. It prepends that version's notes in Added, Changed, Fixed, Breaking order, with fragments sorted by filename inside each section, and preserves released history. It deletes the collected Markdown fragments. An empty fragment set leaves the changelog unchanged; a version that already has notes cannot collect more entries.

`release.json` records the current release's version, date and collected fragment inputs. The validator reproduces the changelog from those inputs and requires every pending fragment from the base revision to be included unchanged. This also permits adding and releasing a change in one pull request: the manifest survives squash merges, so publishing can validate the same inputs without intermediate branch commits. It changes only with a release and is not included in the published packages.

`pnpm run changelog:check [base-ref]` validates pending fragments and the diff against the base (by default `origin/main`, falling back to a local `main`; when neither exists it fails and names `git fetch origin main`). It rejects direct changelog edits without a version bump, uncollected release entries, retained collected fragments and edits to released history. Lint and the commit hook run this check. Pull request CI uses the PR base revision and the merge queue its base revision; publishing validates the collected notes against the revision before the push with `pnpm run changelog:release --check` and `CHANGELOG_BASE_REF` before publishing versions not yet on npm.
