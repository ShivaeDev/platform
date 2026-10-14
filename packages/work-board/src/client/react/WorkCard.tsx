import { type FleetWork, holderOf } from "#browser/views/now.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { Card } from "#client/react/components/ui/Card.tsx";
import { StatusChip } from "#client/react/components/ui/StatusChip.tsx";
import { Age } from "./Age.tsx";
import { PrChip } from "./PrChip.tsx";
import { WorkItemTitle } from "./WorkItemTitle.tsx";

export function WorkCard({
	item,
	state,
	fleet,
}: {
	readonly item: WorkProjection["rows"][number];
	readonly state: State;
	readonly fleet: FleetWork | undefined;
}) {
	return (
		<Card className="work-card" data-item={item.id} data-selected={item.id === state.item ? "true" : undefined}>
			<p className="work-kind">{item.metadata.kind ?? "Kind not recorded"}</p>
			<h3>
				<WorkItemTitle item={item} state={state} />
			</h3>
			<div className="flex flex-wrap items-center gap-2">
				<StatusChip status={item.metadata.status} />
				{Boolean(item.waiting) && <StatusChip status="needs-you" title={item.waiting} />}
				<PrChip url={fleet?.prUrl} />
			</div>
			<p className="work-owner">Holder: {holderOf(item.metadata, fleet)}</p>
			{fleet?.stageEnteredAt !== undefined && fleet.stageEnteredAt !== null && (
				<p className="work-stage">
					In {fleet.stage} for <Age modified={fleet.stageEnteredAt} short />
				</p>
			)}
		</Card>
	);
}
