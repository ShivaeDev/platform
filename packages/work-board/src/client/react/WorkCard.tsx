import { useContext } from "react";
import { cardStatus, type FleetWork, holderOf, stageTime } from "#browser/views/now.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { Card } from "#client/react/components/ui/Card.tsx";
import { StatusChip } from "#client/react/components/ui/StatusChip.tsx";
import { answeredCopy } from "#client/responses/answeredCopy.ts";
import { Age } from "./Age.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
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
	const fleetItems = useContext(FleetItemsContext);
	const status = cardStatus(item.metadata, fleet, item.waiting, item.answered !== undefined);
	const answered = status === "waiting-on-agents" && item.answered ? answeredCopy(item.answered, fleetItems) : undefined;
	const kind = item.metadata.kind === "task" ? undefined : item.metadata.kind;
	return (
		<Card className="work-card" data-item={item.id} data-selected={item.id === state.item ? "true" : undefined}>
			{kind !== undefined && <p className="work-kind">{kind}</p>}
			<h3>
				<WorkItemTitle item={item} state={state} />
			</h3>
			<div className="flex flex-wrap items-center gap-2">
				<StatusChip status={status} title={answered ?? item.waiting} />
				<PrChip url={fleet?.prUrl} />
			</div>
			{answered !== undefined && <p className="work-answer">{answered}</p>}
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
