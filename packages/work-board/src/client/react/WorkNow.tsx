import { Clock, Effect } from "effect";
import { useContext } from "react";
import { laneOf, nowLanes } from "#browser/views/now.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import { FleetItemsContext } from "#client/react/FleetItemsContext.ts";
import { WorkLane } from "#client/react/WorkLane.tsx";

export function WorkNow({ data }: { readonly data: WorkProjection }) {
	const fleet = useContext(FleetItemsContext);
	const ready = fleet?.state === "ready";
	const items = new Map(ready ? [...fleet.completed, ...fleet.items].map((item) => [item.workId, item] as const) : []);
	const recent = new Set(
		ready
			? fleet.completed.filter((item) => item.completedAt >= Effect.runSync(Clock.currentTimeMillis) - 604_800_000).map((item) => item.workId)
			: [],
	);
	const groups = Map.groupBy(data.rows, (item) => laneOf(item.metadata, items.get(item.id), item.fleetApproved));
	return (
		<>
			{!ready && (
				<p role="status">
					Fleet is unavailable. Lanes use authored status. {fleet?.state === "unavailable" ? fleet.reason : "Fleet data has not loaded."}
				</p>
			)}
			<div className="work-columns work-now grid auto-cols-[minmax(260px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-2 max-md:auto-cols-auto max-md:grid-flow-row">
				{nowLanes.map((lane, index) => {
					const rows = (groups.get(lane) ?? []).filter((item) => index !== 5 || recent.has(item.id));
					return (
						<WorkLane collapsed={index === 5} fleet={items} key={lane} lane={lane} rows={rows} state={data.state} virtual={data.rows.length > 200} />
					);
				})}
			</div>
		</>
	);
}
