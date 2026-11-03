import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { pollingScreen } from "#test/pollingScreen.tsx";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();
const FIRST_READ = { diagnostics: "1", fleet: "1" };

screenStory.it(
	"while updates are paused the diagnostics poll reads nothing new",
	[pollingScreen()],
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
	[pollingScreen()],
	function* ({ diagnosticsPollPasses, pauseUpdates, polledReads }) {
		yield* pauseUpdates(false);
		expect(yield* polledReads()).toEqual({ diagnostics: "2", fleet: "2" });

		yield* diagnosticsPollPasses();

		expect(yield* polledReads()).toEqual({ diagnostics: "3", fleet: "3" });
	},
);

screenStory.it(
	"pausing updates again stops the diagnostics poll",
	[pollingScreen()],
	function* ({ diagnosticsPollPasses, pauseUpdates, polledReads }) {
		yield* pauseUpdates(false);
		yield* pauseUpdates(true);
		expect(yield* polledReads()).toEqual({ diagnostics: "2", fleet: "2" });

		yield* diagnosticsPollPasses();

		expect(yield* polledReads()).toEqual({ diagnostics: "2", fleet: "2" });
	},
);

screenStory.it(
	"a view that leaves no longer polls or reads when updates resume",
	[pollingScreen()],
	function* ({ diagnosticsPollPasses, leavePollingView, pauseUpdates, polledReads }) {
		expect(yield* polledReads()).toEqual(FIRST_READ);

		yield* leavePollingView();
		yield* pauseUpdates(false);
		yield* diagnosticsPollPasses();

		expect(yield* polledReads()).toEqual(FIRST_READ);
	},
);
