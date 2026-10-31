import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { holds, running } from "#test/postgres/traits.ts";

const First = defineQueue({ name: "health-1", queue: { retryLimit: 0 }, schema: Schema.Struct({}) });
const Second = defineQueue({ name: "health-2", queue: { retryLimit: 0 }, schema: Schema.Struct({}) });

database.it(
	"health can report only a named queue registered by another runtime",
	[running("app", [First]), running("worker", [Second], { supervise: false }), holds(Second, { active: 1, failed: 1, later: 0, ready: 0 })],
	function* ({ answered, ask, monitorPasses }) {
		yield* monitorPasses(Second.name, "health-2-dlq");

		yield* ask("app", "report worker queue health", (jobs) => jobs.health([Second]));

		expect(yield* answered()).toEqual({
			activeTotal: 1,
			deadLetteredTotal: 1,
			failedTotal: 1,
			jobs: [{ activeCount: 1, deadLetteredCount: 1, failedCount: 1, name: "health-2", queuedCount: 0, readyCount: 0 }],
			queuedTotal: 0,
			readyTotal: 0,
		});
	},
);

database.it(
	"after a monitor pass, health reports each queue's failed, active, queued, ready and dead-lettered counts and their totals",
	[
		running("app", [First, Second], { supervise: false }),
		holds(First, { active: 1, failed: 1, later: 1, ready: 2 }),
		holds(Second, { active: 2, failed: 2, later: 2, ready: 1 }),
	],
	function* ({ answered, ask, monitorPasses }) {
		yield* monitorPasses(First.name, Second.name, "health-1-dlq", "health-2-dlq");
		yield* ask("app", "report health", (jobs) => jobs.health());

		expect(yield* answered()).toEqual({
			activeTotal: 3,
			deadLetteredTotal: 3,
			failedTotal: 3,
			jobs: [
				{ activeCount: 1, deadLetteredCount: 1, failedCount: 1, name: First.name, queuedCount: 3, readyCount: 2 },
				{ activeCount: 2, deadLetteredCount: 2, failedCount: 2, name: Second.name, queuedCount: 3, readyCount: 1 },
			],
			queuedTotal: 6,
			readyTotal: 3,
		});
	},
);
