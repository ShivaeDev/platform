---
"@shivaedev/quality": minor
---

### Added

- A package whose code all runs in one runtime declares it in its manifest with `"quality": { "runtime": "server" }` or `"client"`. `imports/runtime` then treats every source file as that runtime without `src/server/` or `src/client/` folders, and reports a declaration beside runtime folders or an unknown value on the manifest.
- `manifests/exports-shape` accepts a package without modules, such as a dependency shell, whose exports hold only exact assets like `./package.json`.
- Applications, packages that depend on `@shivaedev/platform`, import the pieces their entry points bring by their own names: `imports/manifest` and the `biome` rule's undeclared-dependency check accept a piece that `@shivaedev/platform` brings for any code or `@shivaedev/test-story` brings for test code, and a private package missing that entry point is told which one to add.
- `manifests/application` asks an application for `publicHoistPattern: ["@shivaedev/*"]` in its nearest `pnpm-workspace.yaml` and rejects a dependency entry beside the entry point that already brings it.

### Changed

- `@shivaedev/quality/tsconfig/package.json` resolves modules as `NodeNext`, so package builds emit declarations whose relative imports name resolvable files. Remove per-package `module` and `moduleResolution` overrides from build configs; type-checking through `tsconfig/base.json` is unchanged.
- `appTestConfig` inlines every `@shivaedev` package for the test server instead of `@shivaedev/platform` alone, because an application now imports each framework piece by its own name.
