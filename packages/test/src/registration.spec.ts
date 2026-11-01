import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { vitestRun } from "#test/vitestRun.ts";

vitestRun.it("ordinary and table bodies report the same service failure for generators and Effects", [], function* ({ outcome, runs }) {
	yield* runs("ordinary generator failure", "ordinary Effect failure", "table generator failure", "table Effect failure");

	yield* outcomes([
		["ordinary generator", () => outcome("ordinary generator failure"), "failed: the shared service failed"],
		["ordinary Effect", () => outcome("ordinary Effect failure"), "failed: the shared service failed"],
		["table generator", () => outcome("table generator failure"), "failed: the shared service failed"],
		["table Effect", () => outcome("table Effect failure"), "failed: the shared service failed"],
	]);
});

vitestRun.it(
	"ordinary and table failures share one file Layer, pass the harness's context to the body and close each test's resources",
	[],
	function* ({ lifecycle, runsRegistrationFile }) {
		yield* runsRegistrationFile();

		expect(yield* lifecycle()).toEqual([
			"the shared Layer opened",
			"ordinary generator failure: the same context",
			"released ordinary generator failure's body",
			"released ordinary generator failure's harness",
			"ordinary Effect failure: the same context",
			"released ordinary Effect failure's body",
			"released ordinary Effect failure's harness",
			"table generator failure: the same context",
			"released table generator failure's body",
			"released table generator failure's harness",
			"table Effect failure: the same context",
			"released table Effect failure's body",
			"released table Effect failure's harness",
			"the shared Layer closed",
			"Vitest reported the file complete",
		]);
	},
);
