import { defineRailway, postgres, project, service } from "railway/iac";

export default defineRailway((ctx) => {
	const database = postgres("Postgres");
	const web = service("web", {
		build: { buildCommand: "pnpm build", builder: "RAILPACK" },
		env: {
			"AUTH_CLIENT_IP_HEADER": "x-real-ip",
			"BETTER_AUTH_SECRET": ctx.shared.BETTER_AUTH_SECRET,
			"DATABASE_URL": database.env.DATABASE_URL,
			"HOST": "0.0.0.0",
			"PUBLIC_URL": ctx.shared.PUBLIC_URL,
			"TRUSTED_PROXY": "100.64.0.0/10",
		},
		healthcheck: "/health",
		healthcheckTimeout: 120,
		preDeploy: "pnpm migrate",
		start: "pnpm start",
	});
	const worker = service("worker", {
		build: { buildCommand: "pnpm build", builder: "RAILPACK" },
		deploy: { restartPolicyType: "ON_FAILURE" },
		env: {
			"DATABASE_URL": database.env.DATABASE_URL,
		},
		start: "pnpm worker",
	});
	return project(ctx.projectName ?? "app", { resources: [database, web, worker] });
});
