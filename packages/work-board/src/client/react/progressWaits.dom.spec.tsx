import { expect } from "vitest";
import { progressWaits } from "#test/progressWaits.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { TodayProgress } from "./TodayProgress.tsx";

screenStory.it(
	"Today's work in progress lists each pull request waiting on someone under a badge naming who, and leaves out a wait without a pull request",
	[componentScreen(<TodayProgress data={progressWaits()} failed={false} />)],
	function* ({ inProgressList }) {
		expect(yield* inProgressList()).toEqual(
			expect.objectContaining({
				rows: [
					expect.objectContaining({ id: "task.sample.0" }),
					expect.objectContaining({ badge: "Waiting on automation", id: "automation" }),
					expect.objectContaining({ badge: "Waiting on you", id: "maintainer" }),
					expect.objectContaining({ badge: "Waiting on orchestrator", id: "orchestrator" }),
				],
			}),
		);
	},
);
