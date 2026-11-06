---
"@shivaedev/quality": patch
---

### Fixed

- Follow programmatic bundler entries reached through package build scripts when checking unused code and file names, including Electron main and preload adapters.
- Recognize dependency-cruiser tool configs in file naming and the shared Biome default-export policy while keeping ordinary modules subject to both checks.
