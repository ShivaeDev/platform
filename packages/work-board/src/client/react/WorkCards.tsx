import { useContext } from "react";
import { compareStatuses } from "#browser/views/now.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import { StatusChip } from "#client/react/components/ui/StatusChip.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { WorkCardList } from "./WorkCardList.tsx";

export function WorkCards({ data }: { readonly data: WorkProjection }) {
	const fleet = useContext(FleetItemsContext);
	const items = new Map(fleet?.state === "ready" ? [...fleet.completed, ...fleet.items].map((item) => [item.workId, item] as const) : []);
	const columns = [...Map.groupBy(data.rows, (item) => item.metadata.status)].sort(([left], [right]) => compareStatuses(left, right));
	return (
		<div className="work-columns">
			{columns.map(([status, rows]) => (
				<section aria-label={status ?? "Status not recorded"} className="work-column" key={status ?? ""}>
					<h2>
						<StatusChip status={status} />
						<span className="work-count">{rows.length}</span>
					</h2>
					<WorkCardList fleet={items} rows={rows} state={data.state} virtual={data.rows.length > 200} />
				</section>
			))}
		</div>
	);
}
