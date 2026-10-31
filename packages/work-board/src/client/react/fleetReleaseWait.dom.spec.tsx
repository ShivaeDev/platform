import { expect } from "vitest";
import { nowWork } from "#test/nowWork.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { WorkNow } from "./WorkNow.tsx";

screenStory.it(
	"names the release holding a PR in Now's waiting on automation lane",
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
	({ findElement, readText }) => {
		expect(readText('[aria-label="Waiting on automation"] [data-item="task-0"]')).toContain("Waiting for release PR #99 to merge");
		expect(findElement('[aria-label="Waiting on automation"] a[href="https://github.com/example/project/pull/1"]')).not.toBeNull();
	},
);
