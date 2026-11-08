---
"@shivaedev/deploy": minor
"@shivaedev/create-app": patch
---

### Breaking

- `@shivaedev/deploy`: `databaseService` returns an Effect with an `Error` failure, and `defineRailway` accepts an Effect-returning callback. Migrate `defineRailway(async (ctx) => { const database = await databaseService(...); return project(...); })` to `defineRailway((ctx, project) => Effect.gen(function* () { const database = yield* databaseService(...); return project(ctx.projectName ?? "my-app", { resources: [database] }); }))`.

### Fixed

- `@shivaedev/create-app`: generated applications return an Effect from their Railway config and yield `databaseService` before composing service definitions.
