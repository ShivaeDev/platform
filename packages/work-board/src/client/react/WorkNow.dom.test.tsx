import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { nowWork } from "#test/nowWork.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { WorkNow } from "./WorkNow.tsx";

const data = nowWork(6);
const facts = [
	{ stage: "queued" },
	{ stage: "working" },
	{ stage: "reviewing" },
	{ attentionOwner: "maintainer", stage: "waiting", waitingReason: "Choose a direction" },
	{ attentionOwner: "orchestrator", stage: "waiting", waitingReason: "Approve the brief" },
	{ attentionOwner: "automation", stage: "waiting", waitingReason: "waiting for PR #12 to merge: conflicting app.ts" },
] as const;

for (const sort of ["title", "owner", "status"] as const) {
	screenStory.it(
		`Now puts each Fleet stage in its lane and says who each wait is on and why, sorted by ${sort}`,
		[
			componentScreen(
				<FleetItemsContext.Provider
					value={{
						completed: [],
						items: facts.map((fact, index) => ({ ...fact, document: null, stageEnteredAt: null, updatedAt: null, workId: `task-${index}` })),
						state: "ready",
					}}
				>
					<WorkNow data={{ ...data, state: { ...data.state, sort } }} />
				</FleetItemsContext.Provider>,
			),
		],
		function* ({ nowCard }) {
			yield* outcomes([
				["task-0", () => nowCard("task-0"), expect.objectContaining({ lane: "Queued" })],
				["task-1", () => nowCard("task-1"), expect.objectContaining({ lane: "Working" })],
				["task-2", () => nowCard("task-2"), expect.objectContaining({ lane: "Reviewing" })],
				["task-3", () => nowCard("task-3"), expect.objectContaining({ lane: "Waiting on you", reason: "Choose a direction" })],
				["task-4", () => nowCard("task-4"), expect.objectContaining({ lane: "Waiting on orchestrator", reason: "Approve the brief" })],
				[
					"task-5",
					() => nowCard("task-5"),
					expect.objectContaining({ lane: "Waiting on automation", reason: "waiting for PR #12 to merge: conflicting app.ts" }),
				],
			]);
		},
	);
}
