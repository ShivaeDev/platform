---
"@shivaedev/releases": patch
---

### Fixed

- `releases check` refuses a release whose released manifest still pins an older version of a workspace package in the same release, naming the dependent, the dependency and both versions.
- The pre-1.0 major refusal names its changeset file, and the package-pattern refusal starts with the config path like the other config refusals.
