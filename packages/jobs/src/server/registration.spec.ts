import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { running, runtime } from "#test/runtime/kit.ts";
import { scheduled, worker } from "#test/workers.ts";
import { defineSchedule } from "./defineSchedule.ts";

const Emails = defineQueue({ name: "emails", queue: { retryLimit: 5 }, schema: Schema.Struct({ id: Schema.NumberFromString }) });
const Cleanup = defineSchedule({ cron: "17 3 * * *", name: "cleanup" });

runtime.it(
	"a queue worker's registration creates the dead-letter queue, then the queue with backoff and its retry limit, then its worker",
	[],
	function* ({ clientCalls, createdQueues, start }) {
		yield* start("app", [worker(Emails, "succeeds")]);

		yield* outcomes({
			"client calls": [clientCalls(), ["start", "create queue emails-dlq", "create queue emails", "work emails"]],
			"created queues": [
				createdQueues(),
				[
					{ name: "emails-dlq", options: undefined },
					{ name: "emails", options: { deadLetter: "emails-dlq", retryBackoff: true, retryLimit: 5 } },
				],
			],
		});
	},
);

runtime.it(
	"a schedule's registration creates its queues with three backed-off retries and schedules its cron in UTC after its worker",
	[],
	function* ({ clientCalls, createdQueues, scheduledCrons, start }) {
		yield* start("app", [scheduled(Cleanup, "succeeds")]);

		yield* outcomes({
			"client calls": [clientCalls(), ["start", "create queue cleanup-dlq", "create queue cleanup", "work cleanup", "schedule cleanup"]],
			"created queues": [
				createdQueues(),
				[
					{ name: "cleanup-dlq", options: undefined },
					{ name: "cleanup", options: { deadLetter: "cleanup-dlq", retryBackoff: true, retryLimit: 3 } },
				],
			],
			"scheduled crons": [scheduledCrons(), [{ cron: "17 3 * * *", name: "cleanup", options: { tz: "UTC" } }]],
		});
	},
);

runtime.it("a producer-only registration creates its queues with no worker", [], function* ({ clientCalls, start }) {
	yield* start("app", [Emails]);

	expect(yield* clientCalls()).toEqual(["start", "create queue emails-dlq", "create queue emails"]);
});

runtime.it(
	"a worker receives the decoded payload and runs with the services the runtime started with",
	[running("app", [worker(Emails, "notes its job in the application log")])],
	function* ({ applicationLog, deliver, handled }) {
		yield* deliver("emails", [{ data: { id: "7" }, id: "job-7" }]);

		yield* outcomes({
			"application log": [applicationLog(), ["emails ran job-7"]],
			"handled payloads": [handled("emails"), [{ id: 7 }]],
		});
	},
);

runtime.it(
	"a delivered payload that fails to decode fails its job before the handler runs",
	[running("app", [worker(defineQueue({ name: "typed", schema: Schema.Struct({ count: Schema.Number }) }), "succeeds")])],
	function* ({ deliver, handled, settlements }) {
		yield* deliver("typed", [{ data: { count: "wrong" }, id: "job-1" }]);

		yield* outcomes({
			"handled payloads": [handled("typed"), []],
			"settlements": [settlements(), ["job-1 failed with PgBossPayloadError"]],
		});
	},
);

const Duplicate = defineQueue({ name: "duplicate", schema: Schema.Struct({}) });
const DuplicateSchedule = defineSchedule({ cron: "17 3 * * *", name: "duplicate" });

runtime.it(
	"a queue and a schedule with the same name fail registration before any queue or worker is created",
	[],
	function* ({ clientCalls, failureMessage, start, startup }) {
		yield* start("app", [worker(Duplicate, "succeeds"), scheduled(DuplicateSchedule, "succeeds")]);

		yield* outcomes({
			"app runtime": [startup("app"), "register failed with pg-boss job names must be unique"],
			"client calls": [clientCalls(), ["start", "stop"]],
			"failure message": [failureMessage("app"), "pg-boss register failed: TypeError"],
		});
	},
);
