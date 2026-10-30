# Changelog

## 0.5.1 - 2026-10-30

### Fixed

- Report unreadable skill copies and ownership paths as filesystem failures; only `NotFound` means missing. Preserve read and decode failures as non-enumerable causes in `SkillsError` and include their details in manifest error messages.

## 0.5.0 - 2026-10-30

### Changed

- Require Effect 4.0.6 and align the Effect companion package peers and generated starter catalog to the same exact release. Install the 4.0.6 Effect stack together.
- The `story-testing` skill covers how a story reads: one name per actor, actions that name their change, a proven before state, domain outcomes, a separated action, a true title, `outcomes` for several checks, explained setup, one behaviour per story, stories only for plausible regressions, and settling on events. It now applies to package stories as well as app stories.
- Generated apps record the starter's existing findings for the new story rules in their baseline.

### Fixed

- Register hosted RPC cache-control handling through Effect 4.0.6's request-scoped pre-response API so responses keep `private, no-store`.
- Accept native RPC's `application/x-ndjson` media type while preserving `application/ndjson` callers at the transport guard.
- Keep subscriptions open after their HTTP request body completes; closing the socket still cancels them.

### Breaking

- Specs get new findings from three story rules. `tests/domain-outcomes` reports Effect `Exit`, `Cause` and `Result` uses, `_tag` reads and `"Success"` or `"Failure"` tagged literals: return the outcome in the domain's words from a kit verb or readout. `tests/grouped-outcomes` reports consecutive `expect(yield* …)` checks: write them as rows of one `outcomes` call from `@shivaedev/test-story/server/outcomes.ts`. `tests/wait-on-events` reports sleeps, timers, `eventually`, Vitest fake timers and `TestClock` adjustments: settle on the engine's own signal, and advance the clock in a kit verb named for the time that passes. Record existing findings with `quality baseline write --rule tests/domain-outcomes --rule tests/grouped-outcomes --rule tests/wait-on-events`.

## 0.4.0 - 2026-10-28

### Added

- Ship the `visual-pages` skill, a design language for claude.ai Artifacts and other HTML pages that puts the answer in figures a reader takes in at a glance.

## 0.3.1 - 2026-10-24

### Changed

- Require Effect and its companion packages at exactly 4.0.5. Generated applications use the same versions.

## 0.3.0 - 2026-10-18

### Added

- Ship the `story-testing` skill through the existing selection, sync and check path to guide Platform application stories and test kits.

## 0.2.0 - 2026-10-13

### Changed

- Explain the package as both ShivaeDev's shared skill collection and a practical update path for committed repository files. Clarify cloud portability, Claude compatibility links and the host-discovery boundary.
- Give the package a human-first README, agent guidance, north star and roadmap, and publish `docs/` alongside the README.
- Build package JavaScript, declarations and source maps with TypeScript 7.

### Breaking

- Requires stable Effect 4.0.4 in place of 4.0.0-rc.112. Effect 4.0.4 moves the former `effect/unstable/*` modules to `effect/*` and renames constructors such as `Config.string` to `Config.String`. Install `@effect/platform-node` and `@effect/platform-node-shared` 4.0.4 alongside it.

## 0.1.0 - 2026-10-06

### Added

- Add the `pr-description` skill: the title and body format for pull requests, with Why, How, and optional Decisions and Callouts.
- Add the `shivaedev-skills sync` command. It copies the skills a repository lists in the `shivaedevSkills` field of its `package.json` into `.agents/skills/<name>/`, links each from `.claude/skills/<name>`, and records the package version and a hash of each copy in `.agents/skills/.shivaedev-skills.json`. It removes skills that are no longer selected, never changes a folder the manifest does not list, and refuses to overwrite one.
- Add the `shivaedev-skills check` command. It exits with code 1 and says to run `sync` when the manifest is missing or names another package version, a copy was changed by hand, or the selection and the manifest differ.
- Add `templates/sync-skills.yml`, an opt-in GitHub Actions workflow that runs `check` on same-repository pull requests and, when it fails, syncs, commits and pushes the result.
