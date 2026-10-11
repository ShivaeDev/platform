# Package changes and releases

A consumer-visible change adds one new `packages/<package>/changes/<short-name>.md` file per pull request. Choose a descriptive short name unique to the PR. Internal refactors, tests, tooling and docs need no fragment. Pending entries live in fragments; `CHANGELOG.md` holds released versions only.

```markdown
### Added

- Keep an editor's draft when its query refreshes.
```

Use `### Added`, `### Changed`, `### Fixed` or `### Breaking` with Markdown bullet entries. One fragment can include multiple entries and sections for the same PR. Describe behavior a consumer would look for, and keep claims within the tests that prove them. Two PRs add separate files, so their pending release notes do not share an edit.

## Release a package

The maintainer authorizes releases. In the release pull request:

1. Bump `packages/<package>/package.json` to the approved version.
2. Run `pnpm run changelog:release <package>` from the repository root, for example `pnpm run changelog:release effect-sql`.
3. Review and commit the generated `CHANGELOG.md` and the deleted fragment files with the version bump.
4. Run `pnpm ready`, then open the pull request for human review.

The collector uses the package's version and the current UTC date. It prepends that version's notes in Added, Changed, Fixed, Breaking order, with fragments sorted by filename inside each section, and preserves released history. It deletes the collected Markdown fragments. An empty fragment set leaves the changelog unchanged; a version that already has notes cannot collect more entries.

`pnpm run changelog:check [base-ref]` validates pending fragments and the diff against the base (by default the merge base with `origin/main`). It rejects direct changelog edits without a version bump, uncollected release entries, retained collected fragments and edits to released history. Lint and the commit hook run this check. Pull request CI uses the PR base revision; publishing validates the collected notes against the revision before the push with `pnpm run changelog:release --check` and `CHANGELOG_BASE_REF` before publishing versions not yet on npm.
