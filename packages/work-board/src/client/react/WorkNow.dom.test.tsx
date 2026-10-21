import { expect } from "vitest";
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
		`shows each Fleet stage and names the owner and reason of each wait under ${sort} sorting`,
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
		({ findElement, readText }) => {
			expect(findElement('[aria-label="Queued"] [data-item="task-0"]')).not.toBeNull();
			expect(findElement('[aria-label="Working"] [data-item="task-1"]')).not.toBeNull();
			expect(findElement('[aria-label="Reviewing"] [data-item="task-2"]')).not.toBeNull();
			expect(readText('[aria-label="Waiting on you"]')).toContain("Choose a direction");
			expect(readText('[aria-label="Waiting on orchestrator"]')).toContain("Approve the brief");
			expect(readText('[aria-label="Waiting on automation"]')).toContain("waiting for PR #12 to merge: conflicting app.ts");
		},
	);
}
