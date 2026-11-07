---
"@shivaedev/deploy": minor
---

### Breaking

- Postgres backup schedules and image auto-update windows are no longer configured through `databaseService` IaC. Declare them in an app TypeScript module and run `node node_modules/@shivaedev/deploy/dist/cli.js` to check Railway's API state; pass `--apply` to write missing backup kinds or declared update windows. Set the Railway token, environment, service and volume instance IDs before running it. Railway owns backup cron and retention, which the command reports without changing.
