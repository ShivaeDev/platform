import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { nowWork } from "#test/nowWork.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { WorkNow } from "./WorkNow.tsx";

for (const status of ["superseded", "deferred", "done", "completed", "cancelled", "canceled", "active", "planned"]) {
	const data = nowWork(4);
	const rows = data.rows.map((item) => ({ ...item, metadata: { ...item.metadata, status } }));
	const at = Effect.runSync(Clock.currentTimeMillis);
	const fleetItem = { document: null, stageEnteredAt: null, updatedAt: null };
	screenStory.it(
		`uses Fleet completion times and released state despite authored ${status}`,
		[
			componentScreen(
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
		],
		({ click, findElement, findElements, readText }) => {
			expect(findElement("[data-item]")).toBeNull();
			expect(findElement(".work-total")).toBeNull();
			click(findElement<HTMLButtonElement>('[aria-expanded="false"]'));
			const cards = findElements('[aria-label="Done in the last 7 days"] [data-item]');
			expect([...cards].map((card) => card.getAttribute("data-item"))).toEqual(["task-0"]);
			expect(findElements("[data-status-token]", cards[0])).toHaveLength(1);
			expect(readText("[data-status-token]", cards[0])).toBe("done");
			expect(findElements("[data-item]")).toHaveLength(1);
		},
	);
}
