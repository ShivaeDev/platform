import { Clock, Effect } from "effect";
import { useContext } from "react";
import { laneOf, nowLanes } from "#browser/views/now.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { WorkLane } from "./WorkLane.tsx";

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
	const shown = data.rows.filter((item) => {
		const lane = laneOf(item.metadata, items.get(item.id), item.fleetApproved);
		return lane !== undefined && (lane !== nowLanes[5] || recent.has(item.id));
	}).length;
	const total = data.items.filter((item) => item.metadata.kind === "task" && !item.metadata.requestReceipt).length;
	return (
		<>
			{!ready && (
				<p role="status">
					Fleet is unavailable. Lanes use authored status. {fleet?.state === "unavailable" ? fleet.reason : "Fleet data has not loaded."}
				</p>
			)}
			<p className="work-total" role="status">
				{shown} shown · {total} items in this view
			</p>
			<div className="work-columns work-now">
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
