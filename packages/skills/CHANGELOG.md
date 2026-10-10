# Changelog

## Unreleased

### Changed

- Explain the package as both ShivaeDev's shared skill collection and a practical update path for committed repository files. Clarify cloud portability, Claude compatibility links and the host-discovery boundary.
- Give the package a human-first README, agent guidance, north star and roadmap, and publish `docs/` alongside the README.
- Build package JavaScript, declarations and source maps with TypeScript 7.

## 0.1.0 - 2026-10-06

### Added

- Add the `pr-description` skill: the title and body format for pull requests, with Why, How, and optional Decisions and Callouts.
- Add the `shivaedev-skills sync` command. It copies the skills a repository lists in the `shivaedevSkills` field of its `package.json` into `.agents/skills/<name>/`, links each from `.claude/skills/<name>`, and records the package version and a hash of each copy in `.agents/skills/.shivaedev-skills.json`. It removes skills that are no longer selected, never changes a folder the manifest does not list, and refuses to overwrite one.
- Add the `shivaedev-skills check` command. It exits with code 1 and says to run `sync` when the manifest is missing or names another package version, a copy was changed by hand, or the selection and the manifest differ.
- Add `templates/sync-skills.yml`, an opt-in GitHub Actions workflow that runs `check` on same-repository pull requests and, when it fails, syncs, commits and pushes the result.
