### Added

- Reject production imports of test files and anything under `test-support/` with the default `imports/no-test-code` rule, exported as `noTestCode` from `rules/imports/noTestCode.ts`. Shared code belongs in a production module that tests can import; the rule also checks type imports, re-exports and test assets and takes no registry exceptions.
- Export `trackedPaths(directory)` and `ignoredTrackedPaths(directory)` from `inventory/trackedPaths.ts`, returning promises of absolute tracked paths and tracked paths matching Git ignore rules.

### Fixed

- Keep tracked files checked even when Git ignore patterns match them, including Biome checks. A folder named `generated/` no longer exempts authored files from folder and asset naming checks; ignored, untracked output stays outside discovery.
- Name code repairs in suppression, recommended-rule, empty-import-graph and conflicting-fix guidance instead of suggesting disabled rules or new weakening declarations.
