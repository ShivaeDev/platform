---
"@shivaedev/github": patch
"@shivaedev/pr-watch": patch
---

### Fixed

- `@shivaedev/github`: Preserve each pagination pacing callback's failure type through raw, decoded, bounded and repository lists.
- `@shivaedev/pr-watch`: Stop pagination before sending another request when a page reports exhausted quota, preserving the typed cooldown and leaving incomplete snapshots unsaved.
