import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { collector } from "#test/defined-modules/applicationForm.ts";
import { definedModulesHost } from "#test/defined-modules/story.ts";

definedModulesHost.it(
	"readings read with raw SQL and decoded with a Schema class that marks pulse sensitive reach alice whole, while readings.latest's log and exported span and readings.record's logged defect mask pulse",
	[collector],
	function* ({ exportedReadingsSpan, loggedDefect, loggedReadings, readLatest, recordReading }) {
		yield* recordReading("Monday", 72);

		yield* outcomes([
			["latest readings", () => readLatest(), [{ day: "Monday", pulse: 72 }]],
			["logged readings", () => loggedReadings(), { readings: [{ day: "Monday", pulse: "<redacted>" }] }],
			["exported span", () => exportedReadingsSpan(), [{ day: "Monday", pulse: "<redacted>" }]],
			["Monday recorded again", () => recordReading("Monday", 80), "failed with internal server error"],
			["logged record defect", () => loggedDefect(), { reading: { day: "Monday", pulse: "<redacted>" } }],
		]);
	},
);

definedModulesHost.it(
	"the first update readings.$changes delivers carries alice's pulse, while the log of the readings.latest run behind it masks pulse",
	[],
	function* ({ loggedReadings, recordReading, subscribeToLatest }) {
		yield* recordReading("Monday", 72);

		yield* outcomes([
			["first update", () => subscribeToLatest(), [{ day: "Monday", pulse: 72 }]],
			["logged readings", () => loggedReadings(), { readings: [{ day: "Monday", pulse: "<redacted>" }] }],
		]);
	},
);

definedModulesHost.it(
	"readings.goal, whose plain-object success names pulse without a mark, logs the pulse as it is",
	[],
	function* ({ loggedGoal, readGoal }) {
		yield* readGoal();

		expect(yield* loggedGoal()).toEqual({ pulse: 60 });
	},
);
