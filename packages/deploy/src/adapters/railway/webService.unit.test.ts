import { postgres, type ServiceConfigInput } from "railway/iac";
import { expect, it } from "vitest";
import { webService } from "#adapters/railway/webService.ts";

it("web services carry migration and proxy defaults alongside application settings", () => {
	const database = postgres("database");
	const web = webService("api", {
		build: { buildCommand: "pnpm compile", builder: "RAILPACK" },
		deploy: { limitOverride: { containers: { cpu: 2, memoryBytes: 1_073_741_824 } } },
		env: { "DATABASE_URL": database.env.DATABASE_URL, "HOST": "0.0.0.0" },
		start: "pnpm serve",
	});

	expect(web).toMatchObject({
		build: { buildCommand: "pnpm compile", builder: "RAILPACK" },
		deploy: {
			limitOverride: { containers: { cpu: 2, memoryBytes: 1_073_741_824 } },
			preDeployCommand: ["pnpm migrate"],
			startCommand: "pnpm serve",
		},
		name: "api",
		variables: {
			"AUTH_CLIENT_IP_HEADER": { type: "literal", value: "x-real-ip" },
			"DATABASE_URL": database.env.DATABASE_URL,
			"HOST": { type: "literal", value: "0.0.0.0" },
			"TRUSTED_PROXY": { type: "literal", value: "100.64.0.0/10" },
		},
	});
});

it.each<ServiceConfigInput>([
	{ preDeploy: "pnpm db:migrate" },
	{ preDeployCommand: ["pnpm db:migrate"] },
	{ run: { preDeploy: "pnpm db:migrate" } },
	{ deploy: { preDeployCommand: ["pnpm db:migrate"] } },
])("explicit migration options replace the default: %j", (config) => {
	const web = webService("api", { ...config, start: "pnpm start" });

	expect(web.deploy?.preDeployCommand).toEqual(["pnpm db:migrate"]);
});

it.each<ServiceConfigInput>([{ preDeploy: [] }, { deploy: { preDeployCommand: [] } }])(
	"an explicit empty migration list disables migration: %j",
	(config) => {
		const web = webService("api", { ...config, start: "pnpm start" });

		expect(web.deploy?.preDeployCommand).toEqual([]);
	},
);

it.each(["env", "variables"] as const)("explicit %s proxy values replace the defaults, including empty strings", (key) => {
	const web = webService("api", {
		[key]: { "AUTH_CLIENT_IP_HEADER": "", "EXTRA": "application", "TRUSTED_PROXY": "10.0.0.0/8" },
		start: "pnpm start",
	});

	expect(web.variables).toEqual({
		"AUTH_CLIENT_IP_HEADER": { type: "literal", value: "" },
		"EXTRA": { type: "literal", value: "application" },
		"TRUSTED_PROXY": { type: "literal", value: "10.0.0.0/8" },
	});
});

it("environment overrides win over variables without losing unrelated variables", () => {
	const web = webService("api", {
		env: { "TRUSTED_PROXY": "10.0.0.0/8" },
		start: "pnpm start",
		variables: { "EXTRA": "application", "TRUSTED_PROXY": "127.0.0.1" },
	});

	expect(web.variables).toMatchObject({
		"AUTH_CLIENT_IP_HEADER": { value: "x-real-ip" },
		"EXTRA": { value: "application" },
		"TRUSTED_PROXY": { value: "10.0.0.0/8" },
	});
});
