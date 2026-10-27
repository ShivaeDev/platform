# Changelog

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
