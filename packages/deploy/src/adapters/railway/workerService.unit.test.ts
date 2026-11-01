import { expect, it } from "vitest";
import { workerService } from "#adapters/railway/workerService.ts";

it("workers retain application settings alongside the draining default", () => {
	const worker = workerService("jobs", {
		build: "pnpm build:worker",
		deploy: { limitOverride: { containers: { cpu: 1 } } },
		env: { "QUEUE": "mail" },
		start: "pnpm jobs",
	});

	expect(worker).toMatchObject({
		build: { buildCommand: "pnpm build:worker" },
		deploy: { drainingSeconds: 75, limitOverride: { containers: { cpu: 1 } }, startCommand: "pnpm jobs" },
		name: "jobs",
		variables: { "QUEUE": { type: "literal", value: "mail" } },
	});
	expect(worker.deploy?.preDeployCommand).toBeUndefined();
	expect(worker.variables).not.toHaveProperty("TRUSTED_PROXY");
	expect(worker.variables).not.toHaveProperty("AUTH_CLIENT_IP_HEADER");
});

it.each([0, 120])("explicit draining seconds %i replace the worker default", (drainingSeconds) => {
	const worker = workerService("jobs", { deploy: { drainingSeconds }, start: "pnpm jobs" });

	expect(worker.deploy?.drainingSeconds).toBe(drainingSeconds);
});
