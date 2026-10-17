import { createRailwayContext, project } from "railway/iac";
import { expect, it } from "vitest";
import railway from "./railway.ts";

it("gives only web auth settings and pre-deploy migrations, with a database-only restarting worker", async () => {
	const definition = await railway(createRailwayContext({ projectName: "notes" }), project);
	expect(definition.name).toBe("notes");
	expect(definition.resources).toEqual([
		expect.objectContaining({ address: "database.Postgres", engine: "postgres" }),
		expect.objectContaining({
			address: "service.web",
			build: { buildCommand: "pnpm build", builder: "RAILPACK" },
			deploy: {
				healthcheckPath: "/health",
				healthcheckTimeout: 120,
				preDeployCommand: ["pnpm migrate"],
				startCommand: "pnpm start",
			},
			variables: {
				"BETTER_AUTH_SECRET": { name: "BETTER_AUTH_SECRET", type: "sharedReference" },
				"DATABASE_URL": { output: "DATABASE_URL", resource: "database.Postgres", type: "reference" },
				"HOST": { type: "literal", value: "0.0.0.0" },
				"PUBLIC_URL": { name: "PUBLIC_URL", type: "sharedReference" },
				"TRUSTED_PROXY": { type: "literal", value: "100.64.0.0/10" },
			},
		}),
		expect.objectContaining({
			address: "service.worker",
			build: { buildCommand: "pnpm build", builder: "RAILPACK" },
			deploy: { restartPolicyType: "ON_FAILURE", startCommand: "pnpm worker" },
			variables: {
				"DATABASE_URL": { output: "DATABASE_URL", resource: "database.Postgres", type: "reference" },
			},
		}),
	]);
});
