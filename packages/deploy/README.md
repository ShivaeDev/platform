# @shivaedev/deploy

Railway applications repeat the same database wiring, backup, migration, proxy and worker shutdown settings. Small database, web and worker pieces keep those conventions together while each application supplies its own services and resource limits.

## Describe your application

```ts
import { project, volume } from "railway/iac";
import { databaseService } from "@shivaedev/deploy/adapters/railway/databaseService.ts";
import { webService } from "@shivaedev/deploy/adapters/railway/webService.ts";
import { workerService } from "@shivaedev/deploy/adapters/railway/workerService.ts";

const database = await databaseService("Postgres", {
	limits: { cpu: 2, memoryBytes: 1_073_741_824 },
	volume: volume("postgres-data"),
});
const web = webService("web", { start: "pnpm start" }, database);
const worker = workerService("worker", { start: "pnpm worker" }, database);

export default project("my-app", { resources: [database, web, worker] });
```

The results are native Railway definitions that an app combines into its project.

## Choose the database settings

`databaseService` is asynchronous: await it inside an async `defineRailway` callback or at module level. It takes a name, required `limits.cpu` and `limits.memoryBytes`, optional `limits.diskBytes`, Railway's native `region`, a native `volume(...)` definition and optional `backupSchedules` and `pageCacheTrim`. Limits become `deploy.limitOverride.containers`. The returned definition remains editable for other Railway settings.

### Backups and image updates

Daily, weekly and monthly [Railway volume backups](https://docs.railway.com/volumes/backups) are enabled by default. Set `backupSchedules: ["WEEKLY", "MONTHLY"]` to replace that schedule, `[]` to disable it, or `null` to pass Railway's native null value. Railway controls retention and storage charges. The schedule is attached through `volumeAttachments[volume.name]` with the native volume address, `/var/lib/postgresql/data` mount path and `backupSchedules`; Railway resolves the volume ID. The volume definition is included by Railway when it compiles the attachment, so it need not be repeated in the project's resources.

Use the existing attached volume's exact Railway name when adopting a database. Run `railway config plan` and check that the schedule targets that volume before applying. A different volume name describes a different volume.

The Railway Postgres image receives minor and patch auto-updates as soon as Railway makes them available: `source.autoUpdates` is `{ type: "minor", tagMode: "sha", schedule: null }`. SHA tracking follows changes behind the floating major tag, such as `:18`, without a maintenance window. The helper keeps Railway's image rather than building a custom image.

For an existing database with an unchanged image tag, Railway CLI's `is_equivalent_database_source` skips the source diff, including `autoUpdates`. Set the policy once in the Railway service's image source settings: enable minor updates (which include patches), select SHA tracking, and use the anytime schedule. If using the API, set the service's source `autoUpdates` to the object above through Railway's environment configuration API, keyed by the actual service ID. Verify the saved source policy in Railway; a successful IaC apply alone does not prove that policy changed.

For the API step, send this mutation to Railway's authenticated GraphQL API:

```graphql
mutation SetPostgresImageUpdates($environmentId: String!, $patch: EnvironmentConfig!) {
	environmentPatchCommit(environmentId: $environmentId, patch: $patch)
}
```

Supply these variables with your actual environment and service IDs. The patch changes only the image update policy:

```json
{
	"environmentId": "YOUR_ENVIRONMENT_ID",
	"patch": {
		"services": {
			"YOUR_SERVICE_ID": {
				"source": {
					"autoUpdates": { "type": "minor", "tagMode": "sha", "schedule": null }
				}
			}
		}
	}
}
```

### Page-cache trimming and startup

Railway bills container `memory.current`, which includes the Linux file cache. A table scan can leave hundreds of megabytes of clean cached file pages even when Postgres is idle. With small `shared_buffers`, this cache also serves normal queries, so trimming it on every check would discard useful pages.

The start command launches a background loop that checks `/sys/fs/cgroup/memory.current` every 30 seconds. When usage exceeds 262,144,000 bytes (250 MiB), or 900 seconds have passed since the last trim, it runs `find "$PGDATA" -type f -exec dd iflag=nocache count=0 status=none if={} \;`. Each invocation asks Linux to discard clean cached pages for that file with `posix_fadvise(DONTNEED)`; dirty pages remain. The first check also trims when the system epoch is already beyond the fallback interval.

Override `pageCacheTrim.thresholdBytes`, `pageCacheTrim.checkIntervalSeconds` or `pageCacheTrim.fallbackIntervalSeconds`. The loop runs in the background while the shell immediately executes Railway's own startup chain:

```sh
/usr/bin/tini -g -- /usr/local/bin/wrapper.sh postgres -p 5432 -c "listen_addresses=*"
```

A Railway start command replaces the image ENTRYPOINT. Before returning the database definition, the helper reads the public GHCR manifest and each Linux image config, then checks ENTRYPOINT and CMD against this chain. A changed chain or registry failure stops plan/apply with an error. Keep registry access available from the machine that evaluates the IaC file. Railway's automatic image updates run independently of that evaluation; run plan again to check an updated image before the next IaC apply.

This custom start command is incompatible with Railway PITR and HA. Use the scheduled volume backups instead. When migrating a service that already uses PITR or HA, disable those features in Railway before applying this command and remove the old PITR option, archive settings and pgBackRest setup from application configuration.

Applications own their Postgres server settings separately and can apply them through SQL at startup. Changing Postgres settings through SQL takes the database out of Railway's support scope for support tickets; the dashboard, Data tab, metrics and backups remain available.

Pass the database as the optional third argument to `webService` and `workerService` to supply its native `DATABASE_URL` reference. Explicit `variables.DATABASE_URL` or `env.DATABASE_URL` overrides that reference, including an empty string; `env` wins over `variables`. Keep the database in the project's resources alongside the services. Existing two-argument calls still work without a database.

## Choose the service settings

Both service functions take a service name and Railway's `ServiceConfigInput`. Keep commands, build settings, credentials and resource limits in the application. Alongside optional database wiring, the helpers add the settings below.

`webService` defaults `deploy.preDeployCommand` to `["pnpm migrate"]`, `env.TRUSTED_PROXY` to `"100.64.0.0/10"` and `env.AUTH_CLIENT_IP_HEADER` to `"x-real-ip"`. Additional `env` or `variables` entries coexist with those defaults. Explicit entries replace defaults; Railway's `env` takes precedence over `variables`.

`workerService` defaults `deploy.drainingSeconds` to `75`. Other deploy settings coexist with that default. It adds no web migration or proxy variables.

```ts
import { defineRailway, project, volume } from "railway/iac";
import { databaseService } from "@shivaedev/deploy/adapters/railway/databaseService.ts";
import { webService } from "@shivaedev/deploy/adapters/railway/webService.ts";
import { workerService } from "@shivaedev/deploy/adapters/railway/workerService.ts";

export default defineRailway(async (ctx) => {
	const database = await databaseService("Postgres", {
		limits: { cpu: 2, memoryBytes: 1_073_741_824 },
		volume: volume("postgres-data"),
		backupSchedules: ["DAILY", "WEEKLY"],
	});
	const web = webService(
		"api",
		{
			build: { builder: "RAILPACK", buildCommand: "pnpm build" },
			start: "pnpm serve",
			preDeploy: "pnpm db:migrate",
			env: {
				AUTH_CLIENT_IP_HEADER: "x-forwarded-for",
				TRUSTED_PROXY: "10.0.0.0/8",
				PUBLIC_URL: ctx.shared.PUBLIC_URL,
			},
			deploy: {
				limitOverride: { containers: { cpu: 2, memoryBytes: 1_073_741_824 } },
			},
		},
		database,
	);
	const worker = workerService(
		"jobs",
		{
			start: "pnpm jobs",
			deploy: { drainingSeconds: 120 },
		},
		database,
	);
	return project(ctx.projectName ?? "my-app", {
		resources: [database, web, worker],
	});
});
```

Override the migration through native `preDeploy`, `preDeployCommand`, `run.preDeploy` or `deploy.preDeployCommand` options. Set `preDeploy: []` to disable it. Set `deploy.drainingSeconds: 0` to disable worker draining. Explicit empty strings for proxy variables are preserved, so choose their values according to the application's transport trust policy.

Install the package alongside its Railway peer:

```sh
pnpm add -D @shivaedev/deploy railway
```

These helpers construct definitions; `databaseService` also verifies the image startup metadata. The application owns Railway authentication and applies its project through Railway's tooling.
