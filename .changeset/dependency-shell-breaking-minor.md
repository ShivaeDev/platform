---
"@shivaedev/releases": minor
---

### Added

- A dependency shell, a public package whose `exports` hold only `./package.json`, now releases as a minor when a package it depends on releases a `### Breaking` entry, and its collected notes repeat each of those Breaking bullets under its own `### Breaking`, prefixed with the dependency's name. The shell's release in `plan --json` lists those dependencies as `breakingDependencies`. Every other dependent keeps its patch.
- `forwardedEntry(owner, entry)` from `@shivaedev/releases/forwardedEntry.ts` renders a Breaking entry as a dependency shell repeats it, so a release-notes builder can tell a repeated bullet from the shell's own.
