import { expect } from "vitest";
import { sessionCleanup } from "#test-support/sessionCleanup.ts";

sessionCleanup.it(
	"a DOM story file whose session request settles after its story ends passes without unhandled errors",
	[],
	function* ({ sessionFileRuns }) {
		const run = yield* sessionFileRuns();

		expect(run).toEqual({ errors: [], stories: [{ name: "leaves the real session atom after a null-session response", state: "passed" }] });
	},
);
