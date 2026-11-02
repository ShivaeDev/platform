# @shivaedev/deploy

Railway applications repeat the same database wiring, backup, migration, proxy and worker shutdown settings. Small database, web and worker pieces keep those conventions together while each application supplies its own services and resource limits.

## Describe your application

```ts
import { project } from "railway/iac";
import { databaseService } from "@shivaedev/deploy/adapters/railway/databaseService.ts";
import { webService } from "@shivaedev/deploy/adapters/railway/webService.ts";
import { workerService } from "@shivaedev/deploy/adapters/railway/workerService.ts";

const database = databaseService("Postgres", {
	limits: { cpu: 2, memoryBytes: 1_073_741_824 },
});
const web = webService("web", { start: "pnpm start" }, database);
const worker = workerService("worker", { start: "pnpm worker" }, database);

export default project("my-app", { resources: [database, web, worker] });
```

The results are native Railway definitions that an app combines into its project.

## Choose the database settings

`databaseService` takes a name, required `limits.cpu` and `limits.memoryBytes`, optional `limits.diskBytes`, Railway's native `region`, and optional `backupSchedules`. The limits become `deploy.limitOverride.containers` on the PostgreSQL resource. The native definition remains editable for other Railway settings.

Daily volume backups are enabled by default on PostgreSQL's `/var/lib/postgresql/data` mount. Set `backupSchedules: ["WEEKLY", "MONTHLY"]` to replace that schedule, or `backupSchedules: []` to disable scheduled backups. Explicit `null` is passed through to Railway. These are [Railway volume snapshots](https://docs.railway.com/volumes/backups), with Railway's retention and storage charges. The piece configures the schedule only: it does not create or verify a backup, perform a restore, configure off-site copies or enable PostgreSQL WAL archiving or point-in-time recovery. Those remain operational choices outside this piece.

Pass the database as the optional third argument to `webService` and `workerService` to supply its native `DATABASE_URL` reference. Explicit `variables.DATABASE_URL` or `env.DATABASE_URL` overrides that reference, including an empty string; `env` wins over `variables`. Keep the database in the project's resources alongside the services. Existing two-argument calls still work without a database.

## Choose the service settings

Both service functions take a service name and Railway's `ServiceConfigInput`. Keep commands, build settings, credentials and resource limits in the application. Alongside optional database wiring, the helpers add the settings below.

`webService` defaults `deploy.preDeployCommand` to `["pnpm migrate"]`, `env.TRUSTED_PROXY` to `"100.64.0.0/10"` and `env.AUTH_CLIENT_IP_HEADER` to `"x-real-ip"`. Additional `env` or `variables` entries coexist with those defaults. Explicit entries replace defaults; Railway's `env` takes precedence over `variables`.

`workerService` defaults `deploy.drainingSeconds` to `75`. Other deploy settings coexist with that default. It adds no web migration or proxy variables.

```ts
import { defineRailway, project } from "railway/iac";
import { databaseService } from "@shivaedev/deploy/adapters/railway/databaseService.ts";
import { webService } from "@shivaedev/deploy/adapters/railway/webService.ts";
import { workerService } from "@shivaedev/deploy/adapters/railway/workerService.ts";

export default defineRailway((ctx) => {
	const database = databaseService("Postgres", {
		limits: { cpu: 2, memoryBytes: 1_073_741_824 },
		backupSchedules: ["DAILY", "WEEKLY"],
	});
	const web = webService(
		"api",
		{
			build: { builder: "RAILPACK", buildCommand: "pnpm build" },
			start: "pnpm serve",
			preDeploy: "pnpm db:migrate",
			env: {
				"AUTH_CLIENT_IP_HEADER": "x-forwarded-for",
				"TRUSTED_PROXY": "10.0.0.0/8",
				"PUBLIC_URL": ctx.shared.PUBLIC_URL,
			},
			deploy: { limitOverride: { containers: { cpu: 2, memoryBytes: 1_073_741_824 } } },
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
	return project(ctx.projectName ?? "my-app", { resources: [database, web, worker] });
});
```

Override the migration through native `preDeploy`, `preDeployCommand`, `run.preDeploy` or `deploy.preDeployCommand` options. Set `preDeploy: []` to disable it. Set `deploy.drainingSeconds: 0` to disable worker draining. Explicit empty strings for proxy variables are preserved, so choose their values according to the application's transport trust policy.

Install the package alongside its Railway peer:

```sh
pnpm add -D @shivaedev/deploy railway
```

These helpers construct definitions only. The application owns Railway authentication and applies its project through Railway's tooling.
