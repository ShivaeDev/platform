---
"@shivaedev/quality": patch
---

### Fixed

- Read service-id prefixes and package ownership from workspace manifests, including nested consumer packages with their own npm scope.
- Discover service shapes in installed declarations from the consuming repository's package scopes as well as workspace sources.
