import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#server/definition.ts";
import { database } from "#test/postgres/database.ts";
import { running, storedTogether, waiting } from "#test/postgres/traits.ts";
import { workerBy } from "#test/workers.ts";

const Revised = defineQueue({ name: "revised", schema: Schema.Struct({ id: Schema.Number }), worker: { batchSize: 2, pollingIntervalSeconds: 0.5 } });
const Other = defineQueue({ name: "other", schema: Revised.schema });

for (const queue of [undefined, Revised, Other]) {
	database.it(
		`inspection of ${queue?.name ?? "all queues"} ${queue === Other ? "ignores" : "signals"} a local deferral before the batch continues and PostgreSQL notifications arrive`,
		[
			storedTogether(
				Revised,
				[0, 1].map((id) => ({ as: `job ${id}`, data: { id }, priority: 10 - id })),
			),
			running(
				"app",
				[
					Other,
					workerBy(Revised, ({ id }) =>
						id === 0 ? { afterwards: { defers: "Quota", until: "tomorrow" }, waitsFor: "first" } : { waitsFor: "second" },
					),
				],
				{ changeNotificationsWaitFor: "notifications", controller: "none", handsBatchesOver: "by priority" },
			),
			waiting("first", "job 0 runs at the head of its batch"),
		],
		function* ({ inspectionChanged, open, untilWaiting, watchInspection }) {
			yield* watchInspection("app", queue);
			expect(yield* inspectionChanged("app")).toBe(false);

			yield* open("first");
			yield* untilWaiting("second");

			expect(yield* inspectionChanged("app")).toBe(queue !== Other);
		},
	);
}
