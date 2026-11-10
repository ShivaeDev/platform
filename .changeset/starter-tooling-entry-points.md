---
"@shivaedev/create-app": patch
---

### Changed

- `@shivaedev/create-app`: Generated apps run `pnpm lint`, `pnpm lint:skills` and `pnpm skills:sync` through small entry points in `tooling/` that load the installed `@shivaedev/quality` and `@shivaedev/skills` command code, the same way `tooling/heavy.ts` loads the heavy lock. The commands, their output and their exit codes are unchanged.
