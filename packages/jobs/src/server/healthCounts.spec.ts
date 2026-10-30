import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { existingQueue, running, runtime } from "#test/runtime/kit.ts";
import { queueResult } from "#test/runtime/queueResult.ts";
import { worker } from "#test/workers.ts";

const Reports = defineQueue({ name: "reports", schema: Schema.Struct({}) });

runtime.it(
	"health reports each registered queue's counts, counting its dead-letter queue's queued jobs as dead-lettered",
	[
		existingQueue("reports", queueResult("reports", { activeCount: 2, failedCount: 3, queuedCount: 7, readyCount: 5 })),
		existingQueue("reports-dlq", queueResult("reports-dlq", { activeCount: 9, failedCount: 9, queuedCount: 4, readyCount: 9 })),
		running("app", [worker(Reports, "succeeds")]),
	],
	function* ({ answered, ask }) {
		yield* ask("app", "report health", (jobs) => jobs.health());

		expect(yield* answered()).toEqual({
			activeTotal: 2,
			deadLetteredTotal: 4,
			failedTotal: 3,
			jobs: [{ activeCount: 2, deadLetteredCount: 4, failedCount: 3, name: "reports", queuedCount: 7, readyCount: 5 }],
			queuedTotal: 7,
			readyTotal: 5,
		});
	},
);

runtime.it("health covers producer-only queues", [running("app", [Reports])], function* ({ answered, ask }) {
	yield* ask("app", "report health", (jobs) => jobs.health());

	expect(yield* answered()).toMatchObject({ jobs: [{ name: "reports" }] });
});
