import { defineRailway, postgres, project, service } from "railway/iac";
import proxy from "./proxy.json" with { type: "json" };

export default defineRailway((ctx) => {
	const database = postgres("Postgres");
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
	});
	const worker = service("worker", {
		build: { buildCommand: "pnpm build", builder: "RAILPACK" },
		deploy: { drainingSeconds: 75 },
		env: {
			"DATABASE_URL": database.env.DATABASE_URL,
		},
		start: "pnpm worker",
	});
	return project(ctx.projectName ?? "app", { resources: [database, web, worker] });
});
