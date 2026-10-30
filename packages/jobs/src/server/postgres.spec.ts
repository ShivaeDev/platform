import { type Effect, Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import type { PgBossService } from "#service.ts";
import { database } from "#test/postgres/database.ts";
import { clientStoppedUnderneath, deletedOutside, running } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const RoundTrip = defineQueue({ name: "round-trip", queue: { retryLimit: 0 }, schema: Schema.Struct({ id: Schema.NumberFromString }) });

database.it(
	"a payload encoded on enqueue reaches the worker decoded after its trip through PostgreSQL",
	[running("app", [worker(RoundTrip, "succeeds")])],
	function* ({ enqueue, handled, untilJob }) {
		yield* enqueue("app", RoundTrip, { id: 42 }, { as: "job 42" });
		yield* untilJob("job 42", "completed");

		expect(yield* handled(RoundTrip)).toEqual([{ id: 42 }]);
	},
);

database.it(
	"a stored payload that does not decode is dead-lettered without reaching the worker",
	[running("app", [worker(RoundTrip, "succeeds")])],
	function* ({ adminSends, deadLettered, handled, untilDeadLettered }) {
		yield* adminSends(RoundTrip.name, { id: null }, { as: "malformed job" });
		yield* untilDeadLettered(RoundTrip, 1);

		yield* outcomes({
			"dead-lettered": [deadLettered(RoundTrip), ["malformed job"]],
			"handled payloads": [handled(RoundTrip), []],
		});
	},
);

const Closed = defineQueue({ name: "closed-database", schema: Schema.Struct({}) });

const operations: readonly { readonly call: (jobs: PgBossService) => Effect.Effect<unknown, unknown>; readonly operation: string }[] = [
	{ call: (jobs) => jobs.enqueue(Closed, {}), operation: "enqueue" },
	{ call: (jobs) => jobs.health, operation: "health" },
];

for (const { call, operation } of operations) {
	database.it(
		`${operation} after the pg-boss client stopped underneath fails naming ${operation}, the queue and pg-boss's own error`,
		[running("app", [worker(Closed, "succeeds")], { controller: "none" }), clientStoppedUnderneath("app", Closed.name)],
		function* ({ answered, ask }) {
			yield* ask("app", operation, call);

			expect(yield* answered()).toEqual(expect.stringMatching(new RegExp(`^${operation} closed-database failed with Database not opened\\.`, "u")));
		},
	);
}

const Deleted = defineQueue({ name: "deleted-health", schema: Schema.Struct({}) });

database.it(
	"health counts a registered queue that was deleted outside the runtime as empty",
	[running("app", [worker(Deleted, "succeeds")], { controller: "none" }), deletedOutside(Deleted.name, deadLetterQueueName(Deleted.name))],
	function* ({ answered, ask }) {
		yield* ask("app", "report health", (jobs) => jobs.health);

		expect(yield* answered()).toEqual({
			activeTotal: 0,
			deadLetteredTotal: 0,
			failedTotal: 0,
			jobs: [{ activeCount: 0, deadLetteredCount: 0, failedCount: 0, name: Deleted.name, queuedCount: 0, readyCount: 0 }],
			queuedTotal: 0,
			readyTotal: 0,
		});
	},
);
