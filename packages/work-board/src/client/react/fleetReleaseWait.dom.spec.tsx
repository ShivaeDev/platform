import { expect } from "vitest";
import { nowWork } from "#test/nowWork.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { WorkNow } from "./WorkNow.tsx";

screenStory.it(
	"Now's Waiting on automation lane names the release holding a pull request and links to that pull request",
	[
		componentScreen(
			<FleetItemsContext.Provider
				value={{
					completed: [],
					items: [
						{
							attentionOwner: "automation",
							document: null,
							prUrl: "https://github.com/example/project/pull/1",
							stage: "waiting",
							stageEnteredAt: null,
							updatedAt: null,
							waitingReason: "Waiting for release PR #99 to merge",
							workId: "task-0",
						},
					],
					state: "ready",
				}}
			>
				<WorkNow data={nowWork(1)} />
			</FleetItemsContext.Provider>,
		),
	],
	function* ({ nowCard }) {
		expect(yield* nowCard("task-0")).toEqual(
			expect.objectContaining({
				lane: "Waiting on automation",
				tabStops: expect.arrayContaining(["https://github.com/example/project/pull/1"]),
				text: expect.stringContaining("Waiting for release PR #99 to merge"),
			}),
		);
	},
);
