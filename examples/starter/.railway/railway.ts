import { defineRailway, postgres, project, service } from "railway/iac";
import proxy from "./proxy.json" with { type: "json" };

export default defineRailway((ctx) => {
	const database = postgres("Postgres");
	database.deploy = { ...database.deploy, limitOverride: { containers: { cpu: 2, memoryBytes: 1_073_741_824 } } };
	const web = service("web", {
		build: { buildCommand: "pnpm build", builder: "RAILPACK" },
		env: {
			...proxy,
			"BETTER_AUTH_SECRET": ctx.shared.BETTER_AUTH_SECRET,
			"DATABASE_URL": database.env.DATABASE_URL,
			"HOST": "0.0.0.0",
			"PUBLIC_URL": ctx.shared.PUBLIC_URL,
		},
		healthcheck: "/health",
		healthcheckTimeout: 120,
		preDeploy: "pnpm migrate",
		start: "pnpm start",
		tracing: { autoInstrumentation: false, enabled: true },
	});
	const worker = service("worker", {
		build: { buildCommand: "pnpm build", builder: "RAILPACK" },
		deploy: { drainingSeconds: 75 },
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
