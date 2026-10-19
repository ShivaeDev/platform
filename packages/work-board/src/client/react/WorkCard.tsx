import { useContext } from "react";
import { waitsOnYou } from "#browser/document/asks.ts";
import type { FleetWork } from "#browser/views/now.ts";
import { cardStatus, holderOf, stageTime } from "#browser/views/nowCard.ts";
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
}: {
	readonly item: WorkProjection["rows"][number];
	readonly state: State;
	readonly fleet: FleetWork | undefined;
}) {
	const fleetItems = useContext(FleetItemsContext);
	const asked = waitsOnYou(item);
	const holder = holderOf(item.metadata, fleet, item.answered !== undefined, asked);
	const status = cardStatus(item.metadata, fleet, item.waiting, item.answered !== undefined, asked);
	const answered = status === "waiting-on-agents" && item.answered ? answeredCopy(item.answered, fleetItems) : undefined;
	const kind = item.metadata.kind === "task" ? undefined : item.metadata.kind;
	return (
		<Card
			className="work-card relative gap-2 p-3 transition-colors hover:bg-muted/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring data-selected:ring-2 data-selected:ring-primary"
			data-item={item.id}
			data-selected={item.id === state.item ? "true" : undefined}
			size="sm"
		>
			{kind !== undefined && <p className="work-kind m-0 text-muted-foreground text-xs">{kindLabel(kind)}</p>}
			<h3 className="m-0 font-medium text-sm leading-snug [overflow-wrap:anywhere]">
				<WorkItemTitle
					className="text-foreground no-underline outline-none after:absolute after:inset-0 after:content-['']"
					item={item}
					state={state}
				/>
			</h3>
			<div className="flex flex-wrap items-center gap-2">
				<StatusChip status={status} title={answered ?? item.waiting} />
				<span className="relative z-10">
					<PrChip url={fleet?.prUrl} />
				</span>
			</div>
			{answered !== undefined && <p className="work-answer m-0 text-muted-foreground text-xs">{answered}</p>}
			{holder && <p className="work-owner m-0 text-muted-foreground text-xs">{holder}</p>}
			{fleet?.stageEnteredAt !== undefined && fleet.stageEnteredAt !== null && <StageTime entered={fleet.stageEnteredAt} stage={fleet.stage} />}
		</Card>
	);
}

function StageTime({ stage, entered }: { readonly stage: FleetWork["stage"]; readonly entered: number }) {
	const { label, started } = stageTime(stage);
	return (
		<p className="work-stage m-0 text-muted-foreground text-xs">
			{started ? `${label}, started ` : `${label} `}
			<RowTime at={entered} />
		</p>
	);
}
