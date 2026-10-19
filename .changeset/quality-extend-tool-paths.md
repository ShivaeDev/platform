---
"@shivaedev/quality": minor
---

### Breaking

- `toolOwned` in `files/named-after-export` and `files/other-names` now extends the default tool-owned paths instead of replacing them. Remove copied defaults from your configured lists and keep only repository-specific additions.
