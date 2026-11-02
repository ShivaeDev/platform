import { expect } from "vitest";
import { productionWithout, worker } from "#test-support/worker.ts";

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
