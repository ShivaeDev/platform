---
"@shivaedev/quality": minor
"@shivaedev/create-app": minor
---

### Added

- `@shivaedev/quality`: Require exact external dependency pins and pnpm catalog references when catalogs are declared, including exact catalog entries.
- `@shivaedev/quality`: Check repository paths in Markdown backticks and require CLAUDE.md links to the sibling AGENTS.md.
- `@shivaedev/quality`: Check services/<name>/service.ts for a single exported defineService declaration.
- `@shivaedev/quality`: Check selected text files for non-ASCII bytes with files/ascii options.files.

### Breaking

- `@shivaedev/create-app`: Generated apps store published framework pins in the `framework` catalog of pnpm-workspace.yaml and reference them as catalog:framework in package.json. After a template update, review those catalog pins and run pnpm install. Tools reading framework versions from literal manifest values must resolve the framework catalog instead.

### Fixed

- `@shivaedev/create-app`: Generated minimal-app guidance describes optional notes-module paths as examples instead of pointing at files excluded from the app.
