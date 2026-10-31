import { Option, Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { running } from "#test/postgres/traits.ts";
import { scheduled, worker } from "#test/workers.ts";
import { defineSchedule } from "./defineSchedule.ts";

const Payload = Schema.Struct({ id: Schema.NumberFromString });
const Source = defineQueue({ name: "source", queue: { notify: true }, schema: Payload });
const FollowUp = defineQueue({ name: "follow-up", queue: { notify: true }, schema: Payload });
const Producer = defineQueue({ name: "producer", queue: { notify: true }, schema: Payload });

const chained = running(
	"app",
	[
		worker(Source, { enqueues: (jobs) => jobs.enqueue(FollowUp, { id: 42 }) }),
		worker(FollowUp, { enqueues: (jobs) => jobs.enqueue(Producer, { id: 42 }) }),
		Producer,
	],
	{ useListenNotify: true },
);

database.it(
	"a handler's follow-up job runs on its own queue and enqueues a producer job that decodes",
	[chained],
	function* ({ enqueue, handled, storedPayloads, untilFinished }) {
		expect(yield* storedPayloads(Producer)).toEqual([]);

		yield* enqueue("app", Source, { id: 42 }, { as: "job 42" });
		yield* untilFinished(FollowUp, 1);

		yield* outcomes({
			"follow-up payloads": [handled(FollowUp), [{ id: 42 }]],
			"producer payloads": [storedPayloads(Producer), [Option.some({ id: 42 })]],
		});
	},
);

const Hourly = defineSchedule({ cron: "0 * * * *", name: "publish-follow-up" });
const Message = defineQueue({ name: "scheduled-follow-up", schema: Schema.Struct({ message: Schema.String }) });
const SCHEDULED_MESSAGE = "a message from the scheduled effect";

database.it(
	"a scheduled effect enqueues a follow-up that its worker delivers",
	[
		running("app", [scheduled(Hourly, { enqueues: (jobs) => jobs.enqueue(Message, { message: SCHEDULED_MESSAGE }) }), worker(Message, "succeeds")], {
			schedule: false,
		}),
	],
	function* ({ askTesting, handled, untilFinished }) {
		expect(yield* handled(Message)).toEqual([]);

		yield* askTesting("app", "trigger the hourly schedule", (testing) => testing.trigger(Hourly));
		yield* untilFinished(Message, 1);

		expect(yield* handled(Message)).toEqual([{ message: SCHEDULED_MESSAGE }]);
	},
);
