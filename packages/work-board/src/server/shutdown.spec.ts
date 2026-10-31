import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { drainingBoard } from "#test/liveTraits.ts";

for (const over of ["TCP", "socket"] as const) {
	boardStory.it(
		`a draining shutdown waits the full drain period, then cuts an unfinished ${over} request and removes the socket`,
		[projectFiles({ "home.md": "# Home" }), drainingBoard],
		function* ({ socketFile, shutdownWait, stopTimed, unfinishedRequestEnd, unfinishedRequestOpens }) {
			yield* unfinishedRequestOpens(over);
			expect(yield* socketFile()).toBe("owner read-write socket");

			yield* stopTimed();

			yield* outcomes({
				"the shutdown wait": [shutdownWait(), "the full drain period"],
				"the socket": [socketFile(), "missing"],
				"the unfinished request": [unfinishedRequestEnd(), "cut off"],
			});
		},
	);
}
