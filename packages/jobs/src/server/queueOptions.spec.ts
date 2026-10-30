import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue, defineSchedule } from "#definition.ts";
import { deadlock } from "#test/runtime/deadlock.ts";
import { existingQueue, queueCreationFails, runtime, stopped } from "#test/runtime/kit.ts";
import { queueResult } from "#test/runtime/queueResult.ts";
import { scheduled, worker } from "#test/workers.ts";

const Initial = defineSchedule({ cron: "0 * * * *", name: "cleanup", queue: { expireInSeconds: 15, notify: true } });
const Changed = defineSchedule({ cron: "0 * * * *", name: "cleanup", queue: { notify: false, retryBackoff: false, retryLimit: 0 } });

runtime.it(
	"restarting with unchanged queue settings leaves the stored queue alone",
	[stopped("first", [scheduled(Initial, "succeeds")])],
	function* ({ start, updatedQueues }) {
		yield* start("second", [scheduled(Initial, "succeeds")]);

		expect(yield* updatedQueues()).toEqual([]);
	},
);

runtime.it(
	"restarting with changed queue settings updates the settings it declares and leaves out the ones it does not",
	[stopped("first", [scheduled(Initial, "succeeds")])],
	function* ({ start, updatedQueues }) {
		yield* start("second", [scheduled(Changed, "succeeds")]);

		expect(yield* updatedQueues()).toEqual([
			{ name: "cleanup", options: { deadLetter: "cleanup-dlq", notify: false, retryBackoff: false, retryLimit: 0 } },
		]);
	},
);

const Immutable = defineQueue({ key: () => "entity", name: "immutable", queue: { partition: true, policy: "singleton" }, schema: Schema.Struct({}) });

runtime.it(
	"a queue whose stored partition and policy differ fails registration, and the runtime neither updates nor works it",
	[existingQueue("immutable", queueResult("immutable", { partition: false, policy: "standard" }))],
	function* ({ clientCalls, start, startup }) {
		yield* start("app", [worker(Immutable, "succeeds")]);

		yield* outcomes({
			"app runtime": [startup("app"), "Queue immutable cannot change options after creation: partition, policy"],
			"client calls": [clientCalls(), ["start", "create queue immutable-dlq", "create queue immutable", "stop"]],
		});
	},
);

const Contended = defineQueue({ name: "contended", queue: { partition: true }, schema: Schema.Struct({}) });

runtime.it(
	"queue creation that PostgreSQL rolls back as a deadlock victim is tried again until it succeeds",
	[queueCreationFails("PostgreSQL picks queue creation as a deadlock victim twice", deadlock(), deadlock())],
	function* ({ createdQueues, queueCreationAttempts, start, startup }) {
		yield* start("app", [Contended]);

		yield* outcomes({
			"app runtime": [startup("app"), "started"],
			"created queues": [
				createdQueues(),
				[
					{ name: "contended-dlq", options: undefined },
					{ name: "contended", options: expect.objectContaining({ partition: true }) },
				],
			],
			"creation attempts": [queueCreationAttempts(), 4],
		});
	},
);

runtime.it(
	"queue creation gives up after six deadlocks and fails registration with the last one",
	[queueCreationFails("PostgreSQL picks queue creation as a deadlock victim seven times", ...Array.from({ length: 7 }, deadlock))],
	function* ({ queueCreationAttempts, start, startup }) {
		yield* start("app", [Contended]);

		yield* outcomes({
			"app runtime": [startup("app"), "register contended failed with deadlock detected"],
			"creation attempts": [queueCreationAttempts(), 6],
		});
	},
);

runtime.it(
	"a queue creation failure other than a deadlock fails registration on the first attempt",
	[
		queueCreationFails(
			"queue creation hits a unique violation",
			Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" }),
			deadlock(),
		),
	],
	function* ({ queueCreationAttempts, start, startup }) {
		yield* start("app", [Contended]);

		yield* outcomes({
			"app runtime": [startup("app"), "register contended failed with duplicate key value violates unique constraint"],
			"creation attempts": [queueCreationAttempts(), 1],
		});
	},
);
