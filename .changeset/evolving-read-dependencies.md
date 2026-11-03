---
"@shivaedev/contract": patch
"@shivaedev/server": patch
---

### Fixed

- `@shivaedev/contract`: Refresh server-discovered read scopes on each live subscription rerun and replace their registrations, including when a pushed result is unchanged.
- `@shivaedev/server`: Hosted live queries receive writes to newly discovered relations and stop refreshing for relations they no longer read, for both invalidation hints and pushed results.
