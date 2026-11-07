---
"@shivaedev/deploy": minor
---

### Breaking

- `databaseService` now returns an Effect, and `defineRailway` accepts an Effect-returning callback. Migrate an async config such as `defineRailway(async (ctx) => { const database = await databaseService(...); return project(...); })` to `defineRailway((ctx, project) => Effect.gen(function* () { const database = yield* databaseService(...); return project(ctx.projectName ?? "my-app", { resources: [database] }); }))`.
