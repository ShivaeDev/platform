import { defineRailway, postgres, project } from "railway/iac";
import { webService } from "@shivaedev/deploy/adapters/railway/webService.ts";
import { workerService } from "@shivaedev/deploy/adapters/railway/workerService.ts";

export default defineRailway((ctx) => {
	const database = postgres("Postgres");
	database.deploy = { ...database.deploy, limitOverride: { containers: { cpu: 2, memoryBytes: 1_073_741_824 } } };
	const web = webService("web", {
		build: { buildCommand: "pnpm build", builder: "RAILPACK" },
		env: {
			"BETTER_AUTH_SECRET": ctx.shared.BETTER_AUTH_SECRET,
			"DATABASE_URL": database.env.DATABASE_URL,
			"HOST": "0.0.0.0",
			"PUBLIC_URL": ctx.shared.PUBLIC_URL,
		},
		healthcheck: "/health",
		healthcheckTimeout: 120,
		start: "pnpm start",
		tracing: { autoInstrumentation: false, enabled: true },
	});
	const worker = workerService("worker", {
		build: { buildCommand: "pnpm build", builder: "RAILPACK" },
		env: {
			"DATABASE_URL": database.env.DATABASE_URL,
			"EMAIL_FROM": ctx.shared.EMAIL_FROM,
			"PUBLIC_URL": ctx.shared.PUBLIC_URL,
			"RESEND_API_KEY": ctx.shared.RESEND_API_KEY,
		},
		start: "pnpm worker",
		tracing: { autoInstrumentation: false, enabled: true },
	});
	return project(ctx.projectName ?? "app", { resources: [database, web, worker] });
});
