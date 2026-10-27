---
"@shivaedev/create-app": minor
---

### Changed

- Generated apps depend on `@shivaedev/platform` alone for the framework and on `@shivaedev/test-story` and `@shivaedev/quality` for development, import each piece by its own name, and carry `publicHoistPattern: ["@shivaedev/*"]` in `pnpm-workspace.yaml` so the pieces resolve. `create-app update` merges this setup into an existing app: it removes the direct piece entries the app kept from the template and adds the hoist setting.
