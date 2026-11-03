---
"@shivaedev/work-fleet": minor
---

### Added

- Configure Cloud worker setup instructions with `worker.setupCommand`, defaulting to `./script/update`.

### Fixed

- Use the configured repository remote and base branch in Cloud worker startup and report revision instructions.
- Include the question and PR result protocol in local worker launches and repair turns without duplicating it on retries.

### Breaking

- Import `FleetConfiguration` from `@shivaedev/work-fleet/FleetConfiguration.ts` instead of `@shivaedev/work-fleet/policy.ts`; configuration now lives in its own module.
