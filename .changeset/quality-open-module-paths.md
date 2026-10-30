---
"@shivaedev/quality": minor
---

### Added

- Export every Quality module through its file path, including the DOM environment, unit I/O guard, tooling classifier, bundle-input analysis, shadcn inventory helpers and migration-file naming helpers.

### Breaking

- `manifests/exports-shape` rejects null export entries. Remove those entries so callers can import modules through the file-preserving wildcard; record existing blocks in the baseline while adopting the rule.
- `docs/references` reports null-blocked module paths as unavailable modules instead of private APIs, and `documentedModule` returns `kind: "missing"` for them. Handle `"missing"` instead of `"private"` when using that result, and remove the export blocks before documenting those paths.
