---
"@shivaedev/quality": minor
---

### Added

- A package whose code all runs in one runtime declares it in its manifest with `"quality": { "runtime": "server" }` or `"client"`. `imports/runtime` then treats every source file as that runtime without `src/server/` or `src/client/` folders, and reports a declaration beside runtime folders or an unknown value on the manifest.

- `manifests/exports-shape` accepts a package without modules, such as a dependency shell, whose exports hold only exact assets like `./package.json`.

### Changed

- `@shivaedev/quality/tsconfig/package.json` resolves modules as `NodeNext`, so package builds emit declarations whose relative imports name resolvable files. Remove per-package `module` and `moduleResolution` overrides from build configs; type-checking through `tsconfig/base.json` is unchanged.
