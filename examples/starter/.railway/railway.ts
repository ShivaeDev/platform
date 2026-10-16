import { defineRailway, postgres, project, service } from "railway/iac";

export default defineRailway((ctx) => {
	const database = postgres("Postgres");
	const web = service("web", {
		build: { buildCommand: "pnpm build", builder: "RAILPACK" },
		env: { "DATABASE_URL": database.env.DATABASE_URL, "HOST": "0.0.0.0", "TRUSTED_PROXY": "100.64.0.0/10" },
		healthcheck: "/health",
		healthcheckTimeout: 120,
		preDeploy: "pnpm migrate",
		start: "pnpm start",
	});
	const worker = service("worker", {
		build: { buildCommand: "pnpm build", builder: "RAILPACK" },
		env: { "DATABASE_URL": database.env.DATABASE_URL },
		preDeploy: "pnpm migrate",
		start: "pnpm worker",
	});
	return project(ctx.projectName ?? "app", { resources: [database, web, worker] });
});
