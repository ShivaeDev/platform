import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { failedOver, processes, twoServersAndWorker } from "#test/postgres-example/processKit.ts";

processes.it("every subscribed client starts with a resync hint", [twoServersAndWorker()], function* ({ initialHints }) {
	yield* outcomes({
		a: [initialHints("a"), ["resync"]],
		another: [initialHints("another"), ["resync"]],
		b: [initialHints("b"), ["resync"]],
	});
});

for (const [writer, server] of [
	["a", "first"],
	["b", "second"],
] as const) {
	processes.it(
		`a commit through the ${server} server reaches subscribers on both servers`,
		[twoServersAndWorker()],
		function* ({ hintsSinceAction, order, saveFromServer }) {
			yield* saveFromServer(writer, `server ${server}`);

			yield* outcomes({
				"a hints": [hintsSinceAction("a"), ["changed orders 1"]],
				"a reads": [order("a"), `server ${server}`],
				"b hints": [hintsSinceAction("b"), ["changed orders 1"]],
				"b reads": [order("b"), `server ${server}`],
			});
		},
		30_000,
	);
}

processes.it(
	"a commit from the pg-boss worker reaches subscribers on both servers",
	[twoServersAndWorker()],
	function* ({ hintsSinceAction, order, saveFromWorker }) {
		yield* saveFromWorker();

		yield* outcomes({
			"a hints": [hintsSinceAction("a"), ["changed orders 1"]],
			"a reads": [order("a"), "worker"],
			"b hints": [hintsSinceAction("b"), ["changed orders 1"]],
			"b reads": [order("b"), "worker"],
		});
	},
	30_000,
);

processes.it(
	"a rolled-back write publishes no hint",
	[twoServersAndWorker()],
	function* ({ answers, hintsSinceAction, rejectWrite }) {
		yield* rejectWrite();

		yield* outcomes({
			"a hints": [hintsSinceAction("a"), ["changed orders 1"]],
			answers: [answers(), ["rejected as Rejected", "saved"]],
			"b hints": [hintsSinceAction("b"), ["changed orders 1"]],
		});
	},
	30_000,
);

processes.it(
	"a server that loses its listener resyncs its streams and receives later commits",
	[twoServersAndWorker()],
	function* ({ hintsSinceAction, loseListener, order }) {
		yield* loseListener();

		yield* outcomes({
			"a hints": [hintsSinceAction("a"), ["resync", "resync", "changed orders 1"]],
			"a reads": [order("a"), "after reconnect"],
			"another hints": [hintsSinceAction("another"), ["resync", "resync", "changed orders 1"]],
		});
	},
	30_000,
);

processes.it(
	"after every backend is terminated both servers log the loss and recovery and resync every stream",
	[twoServersAndWorker()],
	function* ({ hintsSinceAction, listenerLogs, order, terminateBackends }) {
		yield* terminateBackends();

		yield* outcomes({
			"a hints": [hintsSinceAction("a"), expect.arrayContaining(["resync", "changed orders 1"])],
			"another hints": [hintsSinceAction("another"), expect.arrayContaining(["resync", "changed orders 1"])],
			"b hints": [hintsSinceAction("b"), expect.arrayContaining(["resync", "changed orders 1"])],
			"b reads": [order("b"), "after failover"],
			"first server logs": [
				listenerLogs("first"),
				[
					"Warn: PostgreSQL change listener lost; resynchronizing live streams",
					"Info: PostgreSQL change listener recovered; resynchronized live streams (2 streams)",
				],
			],
			"second server logs": [
				listenerLogs("second"),
				[
					"Warn: PostgreSQL change listener lost; resynchronizing live streams",
					"Info: PostgreSQL change listener recovered; resynchronized live streams (1 streams)",
				],
			],
		});
	},
	30_000,
);

processes.it(
	"after a failover the pg-boss worker's commits reach both servers",
	[failedOver()],
	function* ({ order, saveFromWorker }) {
		yield* saveFromWorker();

		yield* outcomes({
			"a reads": [order("a"), "worker"],
			"b reads": [order("b"), "worker"],
		});
	},
	30_000,
);
