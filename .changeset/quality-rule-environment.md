---
"@shivaedev/quality": minor
---

### Breaking

- Direct callers of the configured `suppressions/no-ignore-deprecations` check must provide Effect's `FileSystem` service. The Quality CLI already supplies it; custom runners can provide `NodeFileSystem.layer` at their entry point.

### Fixed

- Rule checks retain the caller's services and interruption instead of starting independent runtimes. The deprecation check reads configuration through the supplied file system and fails when a discovered configuration cannot be read.
- Read the CI test-output policy while building its Effect Layer, keeping the synchronous Vitest configuration bridge in an adapter.
