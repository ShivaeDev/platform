import { expect, it } from "vitest";
import { databaseService } from "#adapters/railway/databaseService.ts";
import { webService } from "#adapters/railway/webService.ts";
import { workerService } from "#adapters/railway/workerService.ts";

it("PostgreSQL carries explicit limits and daily volume backups alongside its region", () => {
	const database = databaseService("Postgres", {
		limits: { cpu: 2, memoryBytes: 1_073_741_824 },
		region: "europe-west4",
	});

	expect(database).toMatchObject({
		deploy: {
			limitOverride: { containers: { cpu: 2, memoryBytes: 1_073_741_824 } },
			multiRegionConfig: { "europe-west4": { numReplicas: 1 } },
		},
		engine: "postgres",
		volumeMounts: { "/var/lib/postgresql/data": { backupSchedules: ["DAILY"] } },
	});
});

it.each([{ schedules: ["WEEKLY", "MONTHLY"] }, { schedules: [] }, { schedules: null }] as const)(
	"explicit backup schedules replace daily backups: $schedules",
	({ schedules }) => {
		const database = databaseService("Postgres", {
			backupSchedules: schedules === null ? null : [...schedules],
			limits: { cpu: 1, diskBytes: 2_147_483_648, memoryBytes: 536_870_912 },
		});

		expect(database.volumeMounts?.["/var/lib/postgresql/data"]?.backupSchedules).toEqual(schedules);
		expect(database.deploy?.limitOverride?.containers?.diskBytes).toBe(2_147_483_648);
	},
);

it.each([
	{ makeService: webService, name: "web" },
	{ makeService: workerService, name: "worker" },
])("$name composes with the database without losing application variables", ({ makeService }) => {
	const database = databaseService("primary", { limits: { cpu: 1, memoryBytes: 536_870_912 } });
	const app = makeService("app", { env: { "HOST": "0.0.0.0" }, start: "pnpm start", variables: { "QUEUE": "mail" } }, database);

	expect(app.variables).toMatchObject({
		"DATABASE_URL": database.env.DATABASE_URL,
		"HOST": { type: "literal", value: "0.0.0.0" },
		"QUEUE": { type: "literal", value: "mail" },
	});
});

it.each([
	{ makeService: webService, name: "web" },
	{ makeService: workerService, name: "worker" },
])("$name preserves explicit database variables over composition", ({ makeService }) => {
	const database = databaseService("primary", { limits: { cpu: 1, memoryBytes: 536_870_912 } });
	const app = makeService("app", { start: "pnpm start", variables: { "DATABASE_URL": "application" } }, database);
	const overridden = makeService("app", { env: { "DATABASE_URL": "" }, start: "pnpm start", variables: { "DATABASE_URL": "application" } }, database);

	expect(app.variables?.DATABASE_URL).toEqual({ type: "literal", value: "application" });
	expect(overridden.variables?.DATABASE_URL).toEqual({ type: "literal", value: "" });
});
