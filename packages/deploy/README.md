# @shivaedev/deploy

Railway applications repeat the same database wiring, backup, migration, proxy and worker shutdown settings. Small database, web and worker pieces keep those conventions together while each application supplies its own services and resource limits.

## Describe your application

```ts
import { Effect } from "effect";
import { volume } from "railway/iac";
import { defineRailway } from "@shivaedev/deploy/adapters/railway/define.ts";
import { databaseService } from "@shivaedev/deploy/adapters/railway/databaseService.ts";
import { webService } from "@shivaedev/deploy/adapters/railway/webService.ts";
import { workerService } from "@shivaedev/deploy/adapters/railway/workerService.ts";

export default defineRailway((ctx, project) =>
	Effect.gen(function* () {
		const database = yield* databaseService("Postgres", {
			limits: { cpu: 2, memoryBytes: 1_073_741_824 },
			volume: volume("postgres-data"),
		});
		const web = webService("web", { start: "pnpm start" }, database);
		const worker = workerService("worker", { start: "pnpm worker" }, database);
		return project(ctx.projectName ?? "my-app", { resources: [database, web, worker] });
	}),
);
```

`defineRailway` runs the Effect config when Railway evaluates it. `databaseService` returns an Effect that checks the image startup metadata and fails with a typed `Error` if the registry request fails or the startup chain changes.

## Choose the database settings

`databaseService` checks the Postgres image startup metadata before yielding its definition. It takes a name, required `limits.cpu` and `limits.memoryBytes`, optional `limits.diskBytes`, Railway's native `region`, a native `volume(...)` definition and optional `pageCacheTrim`. Limits become `deploy.limitOverride.containers`. The returned definition remains editable for other Railway settings.

### Backups and image updates

Railway stores [volume backup schedules](https://docs.railway.com/volumes/backups) and image auto-update windows outside the IaC config. Declare the desired settings in your app's TypeScript module, then run the package CLI with Node to check them through Railway's GraphQL API. The command reads backup kinds from `volumeInstanceBackupScheduleList` and auto-update settings from `environment.config.services[serviceId].source.autoUpdates`. Missing auto-update read-back is reported as unknown.

The command checks that daily, weekly and monthly backups are present and that minor-version auto-updates use the declared windows. Railway owns backup cron and retention: the command displays those values as information and never changes them. Check mode only reads. Pass `--apply` to set the declared backup kinds and auto-update windows; matching settings are left alone.

```ts
export const postgresSchedules = {
	backupKinds: ["DAILY", "WEEKLY", "MONTHLY"],
	autoUpdates: {
		type: "minor",
		schedule: Array.from({ length: 7 }, (_, day) => ({ day, startHour: 0, endHour: 24 })),
	},
};
```

Set `RAILWAY_TOKEN` (or `RAILWAY_API_TOKEN`), `RAILWAY_ENVIRONMENT_ID`, `RAILWAY_SERVICE_ID` and `RAILWAY_POSTGRES_VOLUME_INSTANCE_ID`, then run the command from the app root. `--config` selects the TypeScript module exporting `postgresSchedules`; it defaults to `.railway/postgres-schedules.ts`.

```sh
node node_modules/@shivaedev/deploy/dist/cli.js
node node_modules/@shivaedev/deploy/dist/cli.js --apply
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

Applications declare their Postgres server settings once through server’s `postgresSettings`. SQL applies them at startup only with Railway’s deployed-replica variable `RAILWAY_REPLICA_ID` ([Railway variables](https://docs.railway.com/reference/variables)). `railway run` service variables alone do not qualify. Destination port 55432 is always excluded, even with all Railway variables present, to protect shared development PostgreSQL. App hosts and deploy helpers keep one declaration; SQL owns the environment decision.

Changing Postgres settings through SQL takes the database out of Railway's support scope for support tickets; the dashboard, Data tab, metrics and backups remain available.

Pass the database as the optional third argument to `webService` and `workerService` to supply its native `DATABASE_URL` reference. Explicit `variables.DATABASE_URL` or `env.DATABASE_URL` overrides that reference, including an empty string; `env` wins over `variables`. Keep the database in the project's resources alongside the services. Existing two-argument calls still work without a database.

## Choose the service settings

Both service functions take a service name and Railway's `ServiceConfigInput`. Keep commands, build settings, credentials and resource limits in the application. Alongside optional database wiring, the helpers add the settings below.

`webService` defaults `deploy.preDeployCommand` to `["pnpm migrate"]`, `env.TRUSTED_PROXY` to `"100.64.0.0/10"` and `env.AUTH_CLIENT_IP_HEADER` to `"x-real-ip"`. Additional `env` or `variables` entries coexist with those defaults. Explicit entries replace defaults; Railway's `env` takes precedence over `variables`.

`workerService` defaults `deploy.drainingSeconds` to `75`. Other deploy settings coexist with that default. It adds no web migration or proxy variables.

```ts
import { Effect } from "effect";
import { volume } from "railway/iac";
import { defineRailway } from "@shivaedev/deploy/adapters/railway/define.ts";
import { databaseService } from "@shivaedev/deploy/adapters/railway/databaseService.ts";
import { webService } from "@shivaedev/deploy/adapters/railway/webService.ts";
import { workerService } from "@shivaedev/deploy/adapters/railway/workerService.ts";

export default defineRailway((ctx, project) =>
	Effect.gen(function* () {
		const database = yield* databaseService("Postgres", {
			limits: { cpu: 2, memoryBytes: 1_073_741_824 },
			volume: volume("postgres-data"),
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
	}),
);
```

Override the migration through native `preDeploy`, `preDeployCommand`, `run.preDeploy` or `deploy.preDeployCommand` options. Set `preDeploy: []` to disable it. Set `deploy.drainingSeconds: 0` to disable worker draining. Explicit empty strings for proxy variables are preserved, so choose their values according to the application's transport trust policy.

Install the package alongside its Railway peer. Effect applications already provide the required `effect` peer.

```sh
pnpm add -D @shivaedev/deploy railway
```

These helpers construct definitions; `databaseService` also verifies the image startup metadata. The application owns Railway authentication and applies its project through Railway's tooling. Run the deploy package CLI with Node to check or apply the API-managed backup kinds and auto-update windows.
