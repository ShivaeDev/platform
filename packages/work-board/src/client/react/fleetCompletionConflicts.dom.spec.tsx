import { Clock, Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { nowWork } from "#test/nowWork.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { WorkNow } from "./WorkNow.tsx";

const DAY = 86_400_000;

for (const status of ["dropped", "deferred", "done", "ready", "draft"] as const) {
	const data = nowWork(4);
	const rows = data.rows.map((item) => ({ ...item, metadata: { ...item.metadata, status } }));
	const at = Effect.runSync(Clock.currentTimeMillis);
	const fleetItem = { document: null, stageEnteredAt: null, updatedAt: null };
	screenStory.it(
		`Now's Done lane holds only work Fleet completed in the last 7 days, whatever the file says (${status})`,
		[
			componentScreen(
				<FleetItemsContext.Provider
					value={{
						completed: [
							{ ...fleetItem, completedAt: at - DAY, stage: "done", workId: "task-0" },
							{ ...fleetItem, completedAt: at - 8 * DAY, stage: "done", workId: "task-1" },
						],
						items: [
							{ ...fleetItem, stage: "done", workId: "task-2" },
							{ ...fleetItem, stage: "released", workId: "task-3" },
						],
						state: "ready",
					}}
				>
					<WorkNow data={{ ...data, rows }} />
				</FleetItemsContext.Provider>,
			),
		],
		function* ({ laneCards, unfoldLane, workItems }) {
			yield* outcomes([["work shown", () => workItems(), []]]);

			yield* unfoldLane("Done in the last 7 days");

			yield* outcomes([
				["done", () => laneCards("Done in the last 7 days"), [{ id: "task-0", states: ["Done"], title: "Work 4" }]],
				["work shown", () => workItems(), ["task-0"]],
			]);
		},
	);
}
