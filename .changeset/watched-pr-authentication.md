---
"@shivaedev/work-fleet": patch
"@shivaedev/pr-watch": patch
---

### Fixed

- Authenticate PR watching with `GH_TOKEN`, then `GITHUB_TOKEN`, then the signed-in `gh` account. Refuse to start with `GitHub authentication unavailable` when no token is available.
