---
"@shivaedev/work-fleet": minor
---

### Added

- Hosts can select fast or default worker service tiers from queued GitHub Actions runs, with configurable hysteresis, interval-cached reads through Fleet's GitHub reserve, and the current decision in status. Failed reads retain the last tier; each attempt records its selected launch settings.

### Breaking

- Layers composed directly with `hostPolicy` must now provide `LaunchTier` from `host/launchTier.ts`. Provide `launchTierLayer` with the host's `MainSource` and `GithubApi`; `fleetHostLayer` and the CLI wire this automatically.
