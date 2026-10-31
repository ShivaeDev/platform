import { expect } from "vitest";
import { nowWork } from "#test/nowWork.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { WorkNow } from "./WorkNow.tsx";

for (const [stage, lane, label] of [
	["queued", "Queued", "Queued"],
	["waiting", "Waiting on you", "Waiting"],
	["working", "Working", "Working"],
	["reviewing", "Reviewing", "Reviewing"],
] as const) {
	const data = nowWork();
	const statuses = ["done", "done", "dropped", "deferred", "dropped", "dropped"] as const;
	const rows = data.rows.map((item, index) => ({ ...item, metadata: { ...item.metadata, status: statuses[index] } }));
	const items = rows.map((item) => ({
		attentionOwner: "maintainer" as const,
		document: null,
		stage,
		stageEnteredAt: null,
		updatedAt: null,
		workId: item.id,
	}));
	screenStory.it(
		`Now shows work Fleet has ${stage} in ${lane} even when its file says it is closed`,
		[
			componentScreen(
				<FleetItemsContext.Provider value={{ completed: [], items, state: "ready" }}>
					<WorkNow data={{ ...data, rows }} />
				</FleetItemsContext.Provider>,
			),
		],
		function* ({ laneCards }) {
			expect(yield* laneCards(lane)).toEqual(rows.map((row) => ({ id: row.id, states: [label], title: row.title })));
		},
	);
}
