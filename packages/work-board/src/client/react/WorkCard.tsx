import { useContext } from "react";
import { waitsOnYou } from "#browser/document/asks.ts";
import type { FleetWork } from "#browser/views/now.ts";
import { cardLabelStatus, cardStatus, holderOf, stageTime } from "#browser/views/nowCard.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { kindLabel } from "#browser/views/statusLabel.ts";
import { Card } from "#client/react/components/ui/card.tsx";
import { StatusChip } from "#client/react/StatusChip.tsx";
import { answeredCopy } from "#client/responses/answeredCopy.ts";
import { FleetItemsContext } from "./FleetItemsContext.ts";
import { PrChip } from "./PrChip.tsx";
import { RowTime } from "./Time.tsx";
import { WorkItemTitle } from "./WorkItemTitle.tsx";

export function WorkCard({
	item,
	state,
	fleet,
	inLane = false,
}: {
	readonly item: WorkProjection["rows"][number];
	readonly state: State;
	readonly fleet: FleetWork | undefined;
	readonly inLane?: boolean;
}) {
	const fleetItems = useContext(FleetItemsContext);
	const asked = waitsOnYou(item);
	const holder = holderOf(item.metadata, fleet, item.answered !== undefined, asked);
	const status = cardStatus(item.metadata, fleet, item.waiting, item.answered !== undefined, asked);
	const answered = status === "waiting-on-agents" && item.answered ? answeredCopy(item.answered, fleetItems) : undefined;
	const kind = item.metadata.kind === "task" ? undefined : item.metadata.kind;
	return (
		<Card
			className="work-card hover:bg-muted/40 has-[a:focus-visible]:ring-ring data-selected:ring-primary relative gap-2 p-3 transition-colors has-[a:focus-visible]:ring-2 data-selected:ring-2"
			data-item={item.id}
			data-selected={item.id === state.item ? "true" : undefined}
			size="sm"
		>
			{kind !== undefined && <p className="work-kind text-muted-foreground m-0 text-xs">{kindLabel(kind)}</p>}
			<h3 className="m-0 text-sm leading-snug font-medium [overflow-wrap:anywhere]">
				<WorkItemTitle
					className="text-foreground no-underline outline-none after:absolute after:inset-0 after:content-['']"
					item={item}
					state={state}
				/>
			</h3>
			<div className="flex flex-wrap items-center gap-2">
				<StatusChip status={inLane ? cardLabelStatus(status) : status} title={answered ?? item.waiting} />
				<span className="relative z-10">
					<PrChip url={fleet?.prUrl} />
				</span>
			</div>
			{fleet?.stage === "waiting" && <p className="m-0 text-sm">{fleet.waitingReason}</p>}
			{answered !== undefined && <p className="work-answer text-muted-foreground m-0 text-xs">{answered}</p>}
			{holder && <p className="work-owner text-muted-foreground m-0 text-xs">{holder}</p>}
			{fleet?.stageEnteredAt !== undefined && fleet.stageEnteredAt !== null && <StageTime entered={fleet.stageEnteredAt} stage={fleet.stage} />}
		</Card>
	);
}

function StageTime({ stage, entered }: { readonly stage: FleetWork["stage"]; readonly entered: number }) {
	const { label, started } = stageTime(stage);
	return (
		<p className="work-stage text-muted-foreground m-0 text-xs">
			{started ? `${label}, started ` : `${label} `}
			<RowTime at={entered} />
		</p>
	);
}
