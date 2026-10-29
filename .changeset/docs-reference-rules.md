---
"@shivaedev/quality": minor
---

### Added

- `docs/documentedImports.ts` exports `documentedImports`, which reads the workspace modules and named imports a Markdown document references from its code blocks, inline module paths, `name` from `module` phrases and a package README's API rows, with the line of each.

### Breaking

- Repositories get new findings from `docs/references` for Markdown links, heading anchors, links into the repository's own GitHub tree, relative links that leave a published package's README, and documented workspace modules or named imports that do not resolve. Fix the reference, or record existing findings with `quality baseline write --rule docs/references`.
- Repositories get new findings from `docs/unversioned-installs` for a version after a package name in a Markdown install command. Name the package alone, or record existing findings with `quality baseline write --rule docs/unversioned-installs`.
- `linesOf` moves from `inventory/collect.ts` to `inventory/linesOf.ts`: change the import path.
- `builtinName` and `packageNameOf` move from `imports/resolve.ts` to `imports/packageName.ts`: change the import path.
