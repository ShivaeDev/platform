import { expect } from "vitest";
import { productionWithout, worker } from "#test-support/worker.ts";

worker.it("Railway supplies the worker's shared production email settings", [], function* ({ railwayWorkerVariables }) {
	const variables = yield* railwayWorkerVariables();

	expect(variables).toMatchObject({
		"EMAIL_FROM": { name: "EMAIL_FROM", type: "sharedReference" },
		"PUBLIC_URL": { name: "PUBLIC_URL", type: "sharedReference" },
		"RESEND_API_KEY": { name: "RESEND_API_KEY", type: "sharedReference" },
	});
});

for (const missing of ["EMAIL_FROM", "RESEND_API_KEY"] as const) {
	worker.it(
		`a production worker without ${missing} fails with a typed configuration error naming it`,
		[productionWithout(missing)],
		function* ({ workerStarts }) {
			const started = yield* workerStarts();

			expect(started).toMatch(new RegExp(`^configuration failed: .*${missing}`, "sv"));
		},
	);
}
