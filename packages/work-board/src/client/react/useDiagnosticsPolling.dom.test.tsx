import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { pollingScreen } from "#test/pollingScreen.tsx";
import { intervalClock } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();
const FIRST_READ = { diagnostics: "1", fleet: "1" };

screenStory.it(
	"while updates are paused the diagnostics poll reads nothing new",
	[intervalClock(), pollingScreen()],
	function* ({ diagnosticsPollPasses, polledReads }) {
		expect(yield* polledReads()).toEqual(FIRST_READ);

		yield* diagnosticsPollPasses();

		expect(yield* polledReads()).toEqual(FIRST_READ);
	},
);

screenStory.it("resuming updates reads diagnostics and Fleet again at once", [pollingScreen()], function* ({ pauseUpdates, polledReads }) {
	expect(yield* polledReads()).toEqual(FIRST_READ);

	yield* pauseUpdates(false);

	expect(yield* polledReads()).toEqual({ diagnostics: "2", fleet: "2" });
});

screenStory.it(
	"while updates run each diagnostics poll reads diagnostics and Fleet again",
	[intervalClock(), pollingScreen()],
	function* ({ diagnosticsPollPasses, pauseUpdates, polledReads }) {
		yield* pauseUpdates(false);
		expect(yield* polledReads()).toEqual({ diagnostics: "2", fleet: "2" });

		yield* diagnosticsPollPasses();

		expect(yield* polledReads()).toEqual({ diagnostics: "3", fleet: "3" });
	},
);

screenStory.it(
	"pausing updates again stops the diagnostics poll",
	[intervalClock(), pollingScreen()],
	function* ({ diagnosticsPollPasses, pauseUpdates, polledReads }) {
		yield* pauseUpdates(false);
		yield* pauseUpdates(true);
		expect(yield* polledReads()).toEqual({ diagnostics: "2", fleet: "2" });

		yield* diagnosticsPollPasses();

		expect(yield* polledReads()).toEqual({ diagnostics: "2", fleet: "2" });
	},
);

screenStory.it(
	"a view that leaves removes its poll interval and no longer reads when updates resume",
	[intervalClock(), pollingScreen()],
	function* ({ diagnosticsPollTimer, leavePollingView, pauseUpdates, polledReads }) {
		expect(yield* diagnosticsPollTimer()).toBe("scheduled");

		yield* leavePollingView();
		yield* pauseUpdates(false);

		yield* outcomes([
			["poll", () => diagnosticsPollTimer(), "none"],
			["reads", () => polledReads(), FIRST_READ],
		]);
	},
);
