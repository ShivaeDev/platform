import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { nowWork } from "#test/nowWork.ts";
import { screenStory } from "#test/screenStory.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { WorkNow } from "./WorkNow.tsx";

for (const status of ["superseded", "deferred", "done", "completed", "cancelled", "canceled", "active", "planned"]) {
	screenStory.it(`uses Fleet completion times and released state despite authored ${status}`, [], function* ({ render, click }) {
		const data = nowWork(4);
		const rows = data.rows.map((item) => ({ ...item, metadata: { ...item.metadata, status } }));
		const at = Effect.runSync(Clock.currentTimeMillis);
		const fleetItem = { document: null, stageEnteredAt: null, updatedAt: null };
		const view = yield* Effect.promise(() =>
			render(
				<FleetItemsContext.Provider
					value={{
						completed: [
							{ ...fleetItem, completedAt: at - 86_400_000, stage: "completed", workId: "task-0" },
							{ ...fleetItem, completedAt: at - 691_200_000, stage: "completed", workId: "task-1" },
						],
						items: [
							{ ...fleetItem, stage: "completed", workId: "task-2" },
							{ ...fleetItem, stage: "released", workId: "task-3" },
						],
						state: "ready",
					}}
				>
					<WorkNow data={{ ...data, rows }} />
				</FleetItemsContext.Provider>,
			),
		);

		expect(view.container.querySelector("[data-item]")).toBeNull();
		expect(view.container.querySelector(".work-total")).toBeNull();
		click(view.container.querySelector<HTMLButtonElement>('[aria-expanded="false"]'));
		const cards = view.container.querySelectorAll('[aria-label="Done in the last 7 days"] [data-item]');
		expect([...cards].map((card) => card.getAttribute("data-item"))).toEqual(["task-0"]);
		expect(cards[0]?.querySelectorAll("[data-status-token]")).toHaveLength(1);
		expect(cards[0]?.querySelector("[data-status-token]")?.textContent).toBe("done");
		expect(view.container.querySelectorAll("[data-item]")).toHaveLength(1);
	});
}
