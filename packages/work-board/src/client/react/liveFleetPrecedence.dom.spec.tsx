import { expect } from "vitest";
import { nowWork } from "#test/nowWork.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { WorkNow } from "./WorkNow.tsx";

for (const [stage, lane] of [
	["prepared", "Queued"],
	["needs-human", "Waiting on a person"],
	["adopting", "Executing"],
	["executing", "Executing"],
	["reviewing", "Reviewing"],
	["repairing", "Reviewing"],
	["validating", "Reviewing"],
	["delivering", "Delivering"],
] as const) {
	const data = nowWork();
	const statuses = ["done", "completed", "superseded", "deferred", "cancelled", "canceled"];
	const rows = data.rows.map((item, index) => ({ ...item, metadata: { ...item.metadata, status: statuses[index] } }));
	const items = rows.map((item) => ({ document: null, stage, stageEnteredAt: null, updatedAt: null, workId: item.id }));
	screenStory.it(
		`keeps Fleet ${stage} visible in ${lane} despite inactive authored statuses`,
		[
			componentScreen(
				<FleetItemsContext.Provider value={{ completed: [], items, state: "ready" }}>
					<WorkNow data={{ ...data, rows }} />
				</FleetItemsContext.Provider>,
			),
		],
		({ findElement, findElements, readText }) => {
			const column = findElement(`[aria-label="${lane}"]`);
			expect(findElements(".work-card", column)).toHaveLength(statuses.length);
			for (const row of rows) {
				const card = findElement(`[data-item="${row.id}"]`, column);
				expect(readText("h3", card)).toBe(row.title);
				expect(findElements("[data-status-token]", card)).toHaveLength(1);
				expect(readText("[data-status-token]", card)).toBe(stage === "needs-human" ? "needs-you" : stage);
			}
			expect(findElement(".work-total")).toBeNull();
		},
	);
}
