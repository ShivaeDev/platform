import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { database } from "#test/postgres/database.ts";
import { scheduledOutside } from "#test/postgres/scheduledOutside.ts";
import { enqueued, running } from "#test/postgres/traits.ts";
import { scheduled } from "#test/workers.ts";
import { defineSchedule } from "./defineSchedule.ts";
import { defineQueue } from "./definition.ts";

const Nightly = defineSchedule({ cron: "17 3 * * *", name: "nightly" });
const Keyed = defineSchedule({ cron: "18 3 * * *", name: "nightly", schedule: { key: "reports" } });
const First = defineQueue({ name: "first", schema: Schema.Struct({}) });
const Second = defineQueue({ name: "second", schema: Schema.Struct({}) });

for (const schedule of [Nightly, Keyed]) {
	database.it(
		`unscheduling the ${schedule.scheduleOptions.key ?? "default"} schedule removes only that registration`,
		[running("app", [scheduled(Nightly, "succeeds")], { schedule: false, supervise: false }), scheduledOutside(Keyed)],
		function* ({ ask, storedSchedules }) {
			const before = yield* storedSchedules(Nightly.name);
			expect(before.map(({ cron }) => cron).sort()).toEqual([Nightly.cron, Keyed.cron]);

			yield* ask("app", "unschedule nightly", (jobs) => jobs.unschedule(schedule));

			expect(yield* storedSchedules(Nightly.name)).toMatchObject([{ cron: schedule === Nightly ? Keyed.cron : Nightly.cron }]);
		},
	);
}

database.it(
	"deleting a queue removes it and its local worker while preserving other queues",
	[running("app", [First.handle(() => Effect.void), Second], { supervise: false })],
	function* ({ ask, storedQueue, workingQueues }) {
		yield* outcomes([
			["queue before deletion", () => storedQueue(First.name), { name: First.name }],
			["local workers before deletion", () => workingQueues("app"), [First.name]],
		]);

		yield* ask("app", "delete first", (jobs) => jobs.deleteQueue(First));

		yield* outcomes([
			["deleted queue", () => storedQueue(First.name), "missing"],
			["remaining queue", () => storedQueue(Second.name), { name: Second.name }],
			["local workers", () => workingQueues("app"), []],
		]);
	},
);

for (const target of ["first", "all"] as const) {
	database.it(
		`refreshing ${target} queue statistics makes health report its ready jobs`,
		[running("app", [First, Second], { supervise: false }), enqueued(First, {}, { as: "first job" }), enqueued(Second, {}, { as: "second job" })],
		function* ({ answered, ask }) {
			yield* ask("app", "read health before refreshing", (jobs) => jobs.health());
			expect(yield* answered()).toMatchObject({ jobs: [{ readyCount: 0 }, { readyCount: 0 }] });

			yield* ask("app", "refresh queue statistics", (jobs) => jobs.refreshQueueStats(target === "all" ? undefined : First));

			yield* ask("app", "read refreshed health", (jobs) => jobs.health());
			expect(yield* answered()).toMatchObject({
				jobs: [
					{ name: First.name, readyCount: 1 },
					{ name: Second.name, readyCount: target === "all" ? 1 : 0 },
				],
			});
		},
	);
}

database.it("deleting a missing queue fails with a not-found reason", [running("app")], function* ({ answered, ask }) {
	yield* ask("app", "delete a missing queue", (jobs) => jobs.deleteQueue(First));

	expect(yield* answered()).toBe("deleteQueue refused: Queue first does not exist");
});

database.it("a refused queue deletion retains its engine failure and operation", [running("app", [First])], function* ({ answered, ask }) {
	yield* ask("app", "delete a dead-letter queue still in use", (jobs) => jobs.deleteQueue({ name: "first-dlq" }));

	expect(yield* answered()).toBe("deleteQueue first-dlq failed with Queue first-dlq was not deleted: queue first uses it as its dead letter queue");
});

for (const schedule of [Nightly, Keyed]) {
	database.it(
		`unscheduling a missing ${schedule.scheduleOptions.key ?? "default"} registration fails with a not-found reason`,
		[running("app", [defineQueue({ name: Nightly.name, schema: Schema.Struct({}) })])],
		function* ({ answered, ask }) {
			yield* ask("app", "unschedule a missing registration", (jobs) => jobs.unschedule(schedule));

			expect(yield* answered()).toBe(
				`unschedule refused: Schedule nightly with key ${JSON.stringify(schedule.scheduleOptions.key ?? "")} does not exist`,
			);
		},
	);
}
