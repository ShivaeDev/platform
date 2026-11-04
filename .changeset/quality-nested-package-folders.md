---
"@shivaedev/quality": patch
---

### Fixed

- Accept nested package folders when their path below the workspace package root joins with hyphens to the unscoped package name, such as `packages/glass/client` for `@antumbra/glass-client`. Folder-name findings explain both accepted forms.
