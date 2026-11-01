# @shivaedev/deploy

Railway applications repeat the same migration, proxy and worker shutdown settings. Small web and worker pieces keep those conventions together while each application supplies its own services.

## Describe your application

```ts
import { project } from "railway/iac";
import { webService } from "@shivaedev/deploy/adapters/railway/webService.ts";
import { workerService } from "@shivaedev/deploy/adapters/railway/workerService.ts";

const web = webService("web", { start: "pnpm start" });
const worker = workerService("worker", { start: "pnpm worker" });

export default project("my-app", { resources: [web, worker] });
```

The results are native Railway service definitions that an app combines into its project.

## Choose the service settings

Both functions take a service name and Railway's `ServiceConfigInput`. Keep commands, build settings, credentials and resource limits in the application. The helpers add only the settings below.

`webService` defaults `deploy.preDeployCommand` to `["pnpm migrate"]`, `env.TRUSTED_PROXY` to `"100.64.0.0/10"` and `env.AUTH_CLIENT_IP_HEADER` to `"x-real-ip"`. Additional `env` or `variables` entries coexist with those defaults. Explicit entries replace defaults; Railway's `env` takes precedence over `variables`.

`workerService` defaults `deploy.drainingSeconds` to `75`. Other deploy settings coexist with that default. It adds no web migration or proxy variables.

```ts
import { defineRailway, postgres, project } from "railway/iac";
import { webService } from "@shivaedev/deploy/adapters/railway/webService.ts";
import { workerService } from "@shivaedev/deploy/adapters/railway/workerService.ts";

export default defineRailway((ctx) => {
	const database = postgres("Postgres");
	const web = webService("api", {
		build: { builder: "RAILPACK", buildCommand: "pnpm build" },
		start: "pnpm serve",
		preDeploy: "pnpm db:migrate",
		env: {
			"DATABASE_URL": database.env.DATABASE_URL,
			"AUTH_CLIENT_IP_HEADER": "x-forwarded-for",
			"TRUSTED_PROXY": "10.0.0.0/8",
			"PUBLIC_URL": ctx.shared.PUBLIC_URL,
		},
		deploy: { limitOverride: { containers: { cpu: 2, memoryBytes: 1_073_741_824 } } },
	});
	const worker = workerService("jobs", {
		start: "pnpm jobs",
		env: { "DATABASE_URL": database.env.DATABASE_URL },
		deploy: { drainingSeconds: 120 },
	});
	return project(ctx.projectName ?? "my-app", { resources: [database, web, worker] });
});
```

Override the migration through native `preDeploy`, `preDeployCommand`, `run.preDeploy` or `deploy.preDeployCommand` options. Set `preDeploy: []` to disable it. Set `deploy.drainingSeconds: 0` to disable worker draining. Explicit empty strings for proxy variables are preserved, so choose their values according to the application's transport trust policy.

Install the package alongside its Railway peer:

```sh
pnpm add -D @shivaedev/deploy railway
```

These helpers construct definitions only. The application owns Railway authentication and applies its project through Railway's tooling.
