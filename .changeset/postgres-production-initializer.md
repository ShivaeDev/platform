---
"@shivaedev/effect-test-sql": minor
---

### Added

- `makePostgresTestLayer` accepts `initialize` instead of `migrations` to run an application's complete production database initializer once against the prepared template. Pass an Effect using the supplied SQL services or a callback receiving the template's redacted URL. Initialization and optional subsequent fixtures finish and release scoped resources before cloning; deployment stories can still select the empty template. Replace a dummy `migrations` loader and initializer in `fixtures` with `initialize: (url) => migrateDatabase(url)`.

### Breaking

- `PostgresTestOptions` is now a union requiring exactly one of `migrations` and `initialize`. Wrappers that read `options.migrations` must first narrow `options.initialize === undefined`. Replace interfaces extending `PostgresTestOptions` with intersection type aliases. Existing calls supplying migrations retain their behavior.
