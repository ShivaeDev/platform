import { useContext } from "react";
import { compareStatuses } from "#browser/views/now.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import { statusLabel } from "#browser/views/statusLabel.ts";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { StatusChip } from "#client/react/StatusChip.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { WorkCardList } from "./WorkCardList.tsx";

export function WorkCards({ data }: { readonly data: WorkProjection }) {
	const fleet = useContext(FleetItemsContext);
	const items = new Map(fleet?.state === "ready" ? [...fleet.completed, ...fleet.items].map((item) => [item.workId, item] as const) : []);
	const columns = [...Map.groupBy(data.rows, (item) => (item.metadata.status ? statusLabel(item.metadata.status) : ""))]
		.map(([name, rows]) => ({ name, rows, status: rows.map((item) => item.metadata.status).toSorted(compareStatuses)[0] }))
		.sort((left, right) => compareStatuses(left.status, right.status));
	return (
		<div className="work-columns grid gap-6">
			{columns.map(({ name, rows, status }) => (
				<section aria-label={name} className="work-column" key={name}>
					{Boolean(status) && <GroupHeading count={rows.length} status={status} />}
					<WorkCardList fleet={items} rows={rows} state={data.state} virtual={data.rows.length > 200} />
				</section>
			))}
		</div>
	);
}

function GroupHeading({ status, count }: { readonly status: string | undefined; readonly count: number }) {
	return (
		<h2 className="m-0 mb-2 flex items-center gap-2 text-sm font-medium">
			<StatusChip status={status} />
			<Badge className="work-count tabular-nums" variant="secondary">
				{count}
			</Badge>
		</h2>
	);
}
