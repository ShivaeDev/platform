import { expect } from "vitest";
import { failureScreen, failures } from "#test/failure-defaults/story.tsx";

failures.it(
	"a query view without a failure renderer words a server outage with the failure host's wording",
	[
		failureScreen(
			{ hostWording: (failure) => ({ message: `${failure.kind}: ${failure.message}` }), outline: true },
			"with an outline that is down, whose failure host shows the kind",
		),
	],
	function* ({ outline }) {
		expect(yield* outline()).toEqual(["unavailable: Outlines are down for maintenance Retry"]);
	},
);
