---
"@shivaedev/browser-check": patch
"@shivaedev/create-app": patch
"@shivaedev/heavy-lock": patch
"@shivaedev/pr-watch": patch
"@shivaedev/quality": patch
"@shivaedev/releases": patch
"@shivaedev/skills": patch
"@shivaedev/test-story": patch
"@shivaedev/vitest-rerun": patch
"@shivaedev/work-board": patch
"@shivaedev/work-fleet": patch
---

### Fixed

- Report production imports of the `@effect/platform-node` barrel with module subpaths that avoid loading optional integrations such as redis.
- Recognize native Effect `catchTags` record keys regardless of the handler body while retaining diagnostics for actual nested component and hook factories.
- Keep a constant's matching filename valid when the constant becomes private.
- Name each conflicting fix and format pass's file and line/column range when `quality fix` cannot settle.
- Use Node platform module subpaths in package runtimes and commands instead of loading the barrel.
