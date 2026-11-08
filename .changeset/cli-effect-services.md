---
"@shivaedev/create-app": minor
"@shivaedev/releases": minor
"@shivaedev/skills": minor
"@shivaedev/vitest-rerun": minor
---

### Breaking

- `@shivaedev/skills`: `skillPaths` in `@shivaedev/skills/layout.ts` is now an Effect that reads `Path.Path` from the environment. Change `skillPaths(path, repo, name)` to `yield* skillPaths(repo, name)`.
- `@shivaedev/create-app`: `appTemplate`, `prepareManifest`, `prepareFile` and `registryDependencies` in `@shivaedev/create-app/template.ts` now return Effects and fail with `CreateAppError` instead of throwing; `yield*` their results. `appFile` and `prepareFile` take and return `Uint8Array` instead of `Buffer`.
- `@shivaedev/releases`: `loadConfig` in `@shivaedev/releases/workspace.ts` now requires `Path.Path`; provide it with `NodeServices.layer`.
- `@shivaedev/vitest-rerun`: `rerun` in `@shivaedev/vitest-rerun/rerun.ts` now requires `Path.Path`; provide it with `NodeServices.layer`.
