---
"@shivaedev/create-app": minor
---

### Breaking

- Starter server registrations now declare a `migrations` directory beside `group`, `handlers` and `services`. In existing apps, move each module’s migration directory into its registration, derive the combined loader from registered modules, and delete standalone module migration loaders. Keep migration numbers and the existing ledger unchanged.
- Replace host `jobsClientFactory` and worker `clientFactory` test options with `replacements: Layer.succeed(JobsClientFactory, testing.clientFactory)`. Compose other fake services into that same Layer; module service factories now receive the database URL and optional pool size. `create-app update` merges the starter side of these changes into existing apps for review.
- Starter test PostgreSQL clients now use the app’s camelCase name transforms; remove SQL aliases and `withoutTransform` workarounds from test-support queries that expect camelCase result fields.
