import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { database } from "#test/postgres/database.ts";
import { running } from "#test/postgres/traits.ts";
import { scheduled } from "#test/workers.ts";
import { defineSchedule } from "./defineSchedule.ts";

const Nightly = defineSchedule({ cron: "17 3 * * *", name: "nightly", schedule: { key: "daily", startAfter: 86_400 } });

database.it(
	"running a registered schedule now processes exactly one normal run immediately and preserves its timetable",
	[running("worker", [scheduled(Nightly, "succeeds")], { schedule: false }), running("app", [])],
	function* ({ runScheduleNow, untilIdle, handled, job, storedSchedules }) {
		const timetable = yield* storedSchedules(Nightly.name);
		expect(yield* handled(Nightly)).toEqual([]);

		yield* runScheduleNow("app", Nightly, "manual run");
		yield* untilIdle("worker");

		yield* outcomes([
			["normal handler runs", () => handled(Nightly), [null]],
			["normal run", () => job("manual run"), { data: null, state: "completed" }],
		]);
		expect(yield* storedSchedules(Nightly.name)).toEqual(timetable);
	},
);

database.it("a missing schedule registration refuses an immediate run with its name and key", [running("app", [])], function* ({ ask, answered }) {
	yield* ask("app", "run the unregistered nightly schedule", (jobs) => jobs.runScheduleNow(Nightly));

	expect(yield* answered()).toBe('runScheduleNow refused: Schedule nightly with key "daily" does not exist');
});
