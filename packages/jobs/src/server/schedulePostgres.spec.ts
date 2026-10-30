import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineSchedule } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { scheduled } from "#test/workers.ts";

const Nightly = defineSchedule({ cron: "17 3 * * *", name: "nightly" });

database.it(
	"a runtime that runs a schedule stores its cron in UTC with default retries and a dead-letter queue",
	[],
	function* ({ start, storedQueue, storedSchedules }) {
		expect(yield* storedSchedules("nightly")).toEqual([]);

		yield* start("app", [scheduled(Nightly, "succeeds")]);

		yield* outcomes({
			"stored dead-letter queue": [storedQueue("nightly-dlq"), expect.objectContaining({ name: "nightly-dlq" })],
			"stored queue": [storedQueue("nightly"), expect.objectContaining({ deadLetter: "nightly-dlq", retryBackoff: true, retryLimit: 3 })],
			"stored schedule": [
				storedSchedules("nightly"),
				[{ cron: "17 3 * * *", name: "nightly", options: expect.objectContaining({ tz: "UTC" }), timezone: "UTC" }],
			],
		});
	},
);
