import { DateTime, Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { storedTogether } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Reports = defineQueue({ name: "claim-clock", schema: Schema.Struct({ title: Schema.String }) });

for (const date of ["1900-01-01", "2100-01-01"]) {
	database.it(
		`an expiring job completes with a usable budget when the story clock is at ${date}`,
		[storedTogether(Reports, [{ as: "report", data: { title: "Quarterly report" }, expireInSeconds: 60 }])],
		function* ({ handled, job, remainingBudgets, start, untilJob }) {
			yield* start("app", [worker(Reports, "succeeds")]);
			yield* untilJob("report", "completed");

			yield* outcomes({
				"handler payload": [handled(Reports), [{ title: "Quarterly report" }]],
				"job": [job("report"), expect.objectContaining({ state: "completed" })],
				"remaining budget": [remainingBudgets(Reports), [expect.closeTo(60_000, -3)]],
			});
		},
		{ clock: DateTime.makeUnsafe(date) },
	);
}
