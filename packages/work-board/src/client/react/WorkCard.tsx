import { cardStatus, type FleetWork, holderOf, stageTime } from "#browser/views/now.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { Card } from "#client/react/components/ui/card.tsx";
import { StatusChip } from "#client/react/StatusChip.tsx";
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
	const holder = holderOf(item.metadata, fleet);
	const kind = item.metadata.kind === "task" ? undefined : item.metadata.kind;
	return (
		<Card className="work-card gap-2 p-4" data-item={item.id} data-selected={item.id === state.item ? "true" : undefined}>
			{kind !== undefined && <p className="work-kind">{kind}</p>}
			<h3>
				<WorkItemTitle item={item} state={state} />
			</h3>
			<div className="flex flex-wrap items-center gap-2">
				<StatusChip status={cardStatus(item.metadata, fleet, item.waiting)} title={item.waiting} />
				<PrChip url={fleet?.prUrl} />
			</div>
			{holder && <p className="work-owner">{holder}</p>}
			{fleet?.stageEnteredAt !== undefined && fleet.stageEnteredAt !== null && <StageTime entered={fleet.stageEnteredAt} stage={fleet.stage} />}
		</Card>
	);
}

function StageTime({ stage, entered }: { readonly stage: FleetWork["stage"]; readonly entered: number }) {
	const { ended, label } = stageTime(stage);
	return (
		<p className="work-stage">
			{label} {ended ? "" : "for "}
			<Age modified={entered} short />
			{ended ? " ago" : ""}
		</p>
	);
}
