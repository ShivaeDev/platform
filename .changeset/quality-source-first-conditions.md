---
"@shivaedev/quality": minor
---

### Added

- `manifests/source-first` reports a `package.json` `exports` or `imports` condition block that lists the `source` condition after another condition, because TypeScript then reads built declarations instead of the sources once they exist.
