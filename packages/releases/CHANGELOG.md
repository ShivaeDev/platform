# Changelog

## 0.5.0 - 2026-10-30

### Fixed

- Keep release validation failures in the typed error channel, preserve original failures as non-enumerable causes, and report unsuccessful git commands as string-tagged `GitError` failures. Run git history reads through interruptible child processes and files through the Effect filesystem. Refuse a resolved base without common history instead of falling back to a different branch. Parse CLI commands with Effect CLI and reject unknown arguments with usage text while preserving plan output.
- The pre-1.0 major refusal names its changeset file, and the package-pattern refusal starts with the config path like the other config refusals.

### Breaking

- Return Effects from `parseChangeset`, `parseBody`, `computePlan`, `collectChangelog`, `decodePackage`, `planDiff` and `validateDiff`; yield these functions in an Effect program instead of calling them synchronously. Remove `requireThat` and `attempt`; fail directly with `ChangesetError` and use native Effect or Schema operations for fallible work. Provide `ChildProcessSpawner` alongside `FileSystem` for `readHistory` and `checkRepository`, or supply `NodeServices.layer` in Node applications.

## 0.4.1 - 2026-10-30

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.

## 0.4.0 - 2026-10-27

### Breaking

- Rename `@shivaedev/changesets` to `@shivaedev/releases`, and its command from `changesets` to `releases`. Change dependency declarations and imports from `@shivaedev/changesets/...` to `@shivaedev/releases/...`; module paths inside the package are unchanged.

## 0.3.0 - 2026-10-26

### Added

- Accept package renames and removals declared in Breaking changeset notes, preserve released history for in-place renames, and release only remaining package names.

## 0.2.0 - 2026-10-26

### Breaking

- `apply` no longer writes the `release` JSON file in `.changeset/`, and `check` no longer reads it. Consumers should delete that file after their next release. Checks derive releases from deleted base changesets, package versions and dated changelog headings. New packages release from the `0.0.0` placeholder, with consumed changesets present at the base.

## 0.1.3 - 2026-10-25

### Fixed

- Reject each pre-1.0 package's patch bump when a changeset contains Added or Breaking notes. Check, plan and apply report the fragment, package, declared bump and required minor bump before combining release requests.

## 0.1.2 - 2026-10-24

### Changed

- Require Effect and its companion packages at exactly 4.0.5. Generated applications use the same versions.

## 0.1.1 - 2026-10-18

### Fixed

- Validate an in-progress merge against all incoming parents, including octopus merges, so releases already on main pass the commit hook while edits to released history still fail.

## 0.1.0 - 2026-10-18

### Added

- Plan and apply workspace releases from root changesets with explicit bumps, grouped release notes and transitive published dependents.
- Validate pending changesets and reproduce collected releases from manifests while protecting released history and later pending changes.
- Run repository release hooks as typed Effect functions through the CLI or the plan, apply and check Effect APIs.
