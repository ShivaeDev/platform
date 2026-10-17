### Fixed

- System shows the GitHub rate limits Fleet recorded from its own responses, one row per resource with its observation age and any active rate-limit wait or pause below Fleet's 20% reserve, instead of reading `/rate_limit` itself.

### Breaking

- `GithubLimits` is an array of per-resource observations (`limit`, `remaining`, `used`, `reset`, `resource`, `observedAt`, `limitedUntil`, `limitedBy`), and `FleetHealth` gains an optional `github` field carrying them. `githubLimits(fleet)` reads them from a Fleet health source instead of running `gh api rate_limit`. Release together with `@shivaedev/work-fleet`.
