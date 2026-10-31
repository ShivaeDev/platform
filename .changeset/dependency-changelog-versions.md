---
"@shivaedev/releases": patch
---

### Fixed

- List each moved published workspace dependency with its old and new version in dependency-only changelog entries; keep a package's own changeset notes when present. `collectChangelog` accepts an optional fifth argument with published dependency names to render these details.
