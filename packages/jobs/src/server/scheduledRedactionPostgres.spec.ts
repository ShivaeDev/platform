import { Effect } from "effect";
import { expect } from "vitest";
import { database } from "#test/postgres/database.ts";
import { controlled, running } from "#test/postgres/traits.ts";
import { defineSchedule } from "./defineSchedule.ts";

const Nightly = defineSchedule({ cron: "17 3 * * *", name: "nightly", queue: { retryLimit: 0 } });

for (const { failure, logged } of [
	{ failure: "nightly failed: password=scheduled-secret", logged: "nightly failed: password=<redacted>" },
	{ failure: "nightly failed: provider unavailable; try again tomorrow", logged: "nightly failed: provider unavailable; try again tomorrow" },
]) {
	database.it(
		`a scheduled effect logs its failure as ${logged}`,
		[
			running("app", [Nightly.run(Effect.fail(new Error(failure)).pipe(Effect.tapCause(Effect.logError)))], { schedule: false }),
			controlled((testing) => testing.trigger(Nightly), "trigger the nightly schedule"),
		],
		function* ({ logged: logLines, untilIdle }) {
			yield* untilIdle("app");

			expect(yield* logLines("app")).toEqual([{ level: "Error", message: logged }]);
		},
	);
}
