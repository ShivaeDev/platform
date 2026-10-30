import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { running, stoppedAfterwards } from "#test/postgres/traits.ts";

const Payload = Schema.Struct({});
const Initial = defineQueue({ name: "options", queue: { expireInSeconds: 10, retryDelayMax: 10, retryLimit: 1 }, schema: Payload });
const Changed = defineQueue({ name: "options", queue: { expireInSeconds: 45, notify: true, retryDelayMax: 30, retryLimit: 5 }, schema: Payload });
const Repartitioned = defineQueue({
	key: () => "entity",
	name: "options",
	queue: { expireInSeconds: 60, partition: true, policy: "singleton" },
	schema: Payload,
});

const startedOnce = [running("first", [Initial]), stoppedAfterwards("first")];

database.it(
	"a restart with changed queue options updates the stored queue that new jobs take their settings from",
	startedOnce,
	function* ({ adminSends, start, storedJobs, storedQueue }) {
		expect(yield* storedQueue("options")).toMatchObject({ expireInSeconds: 10, notify: false, retryDelayMax: 10, retryLimit: 1 });

		yield* start("second", [Changed]);

		yield* adminSends("options", {}, { as: "new job" });
		yield* outcomes({
			"new job": [storedJobs("options"), [expect.objectContaining({ expireInSeconds: 45, job: "new job", retryLimit: 5 })]],
			"stored queue": [storedQueue("options"), expect.objectContaining({ expireInSeconds: 45, notify: true, retryDelayMax: 30, retryLimit: 5 })],
		});
	},
);

database.it(
	"a restart that changes the queue's partition and policy fails and leaves the stored queue as it was",
	startedOnce,
	function* ({ start, startup, storedQueue }) {
		expect(yield* storedQueue("options")).toMatchObject({ expireInSeconds: 10, partition: false, policy: "standard" });

		yield* start("second", [Repartitioned]);

		yield* outcomes({
			"startup": [startup("second"), expect.stringContaining("partition, policy")],
			"stored queue": [storedQueue("options"), expect.objectContaining({ expireInSeconds: 10, partition: false, policy: "standard" })],
		});
	},
);
