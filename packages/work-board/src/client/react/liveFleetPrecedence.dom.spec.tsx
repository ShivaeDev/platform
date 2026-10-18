import { Effect } from "effect";
import { expect } from "vitest";
import { nowWork } from "#test/nowWork.ts";
import { screenStory } from "#test/screenStory.ts";
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
	screenStory.it(`keeps Fleet ${stage} visible in ${lane} despite inactive authored statuses`, [], function* ({ render }) {
		const data = nowWork();
		const statuses = ["done", "completed", "superseded", "deferred", "cancelled", "canceled"];
		const rows = data.rows.map((item, index) => ({ ...item, metadata: { ...item.metadata, status: statuses[index] } }));
		const items = rows.map((item) => ({ document: null, stage, stageEnteredAt: null, updatedAt: null, workId: item.id }));
		const view = yield* Effect.promise(() =>
			render(
				<FleetItemsContext.Provider value={{ completed: [], items, state: "ready" }}>
					<WorkNow data={{ ...data, rows }} />
				</FleetItemsContext.Provider>,
			),
		);

		const column = view.container.querySelector(`[aria-label="${lane}"]`);
		expect(column?.querySelectorAll(".work-card")).toHaveLength(statuses.length);
		for (const row of rows) {
			const card = column?.querySelector(`[data-item="${row.id}"]`);
			expect(card?.querySelector("h3")?.textContent).toBe(row.title);
			expect(card?.querySelectorAll("[data-status-token]")).toHaveLength(1);
			expect(card?.querySelector("[data-status-token]")?.textContent).toBe(stage === "needs-human" ? "needs-you" : stage);
		}
		expect(view.container.querySelector(".work-total")).toBeNull();
	});
}
