import { cn } from "cn";
import { ChevronRight } from "lucide-react";
import type { FleetWork, NowLane } from "#browser/views/now.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { buttonVariants } from "#client/react/components/ui/button.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#client/react/components/ui/collapsible.tsx";
import { EmptyState } from "#client/react/EmptyState.tsx";
import { WorkCardList } from "#client/react/WorkCardList.tsx";

const emptyLanes: Readonly<Record<NowLane, { readonly title: string; readonly description: string }>> = {
	"Done in the last 7 days": { description: "Work finished in the last 7 days appears here.", title: "Nothing done this week" },
	Queued: { description: "Approved work waits here until an agent starts it.", title: "Nothing queued" },
	Reviewing: { description: "Work under review appears here.", title: "Nothing in review" },
	"Waiting on automation": { description: "Work waiting on automation appears here.", title: "Nothing waiting on automation" },
	"Waiting on orchestrator": { description: "Work waiting on the orchestrator appears here.", title: "Nothing waiting on orchestrator" },
	"Waiting on you": { description: "Work that needs your answer appears here.", title: "Nothing waiting on you" },
	Working: { description: "Work an agent is building appears here.", title: "Nothing working" },
};

export function WorkLane({
	lane,
	rows,
	state,
	fleet,
	virtual,
	bounded,
	collapsed,
	className,
	unavailable,
}: {
	readonly lane: NowLane;
	readonly rows: WorkProjection["rows"];
	readonly state: State;
	readonly fleet: ReadonlyMap<string, FleetWork>;
	readonly virtual: boolean;
	readonly bounded?: boolean | undefined;
	readonly collapsed: boolean;
	readonly className?: string | undefined;
	readonly unavailable?: string | undefined;
}) {
	const count = unavailable === undefined && (
		<Badge className="work-count shrink-0 tabular-nums" variant="secondary">
			{rows.length}
		</Badge>
	);
	const list =
		unavailable === undefined ? (
			<LaneCards bounded={bounded} fleet={fleet} lane={lane} rows={rows} state={state} virtual={virtual} />
		) : (
			<p className="m-0 text-muted-foreground text-xs">{unavailable}</p>
		);
	if (collapsed && unavailable === undefined) {
		return (
			<Collapsible render={<section aria-label={lane} className={cn("work-column group/lane min-w-0", className)} />}>
				<h2 className="m-0 mb-2 flex min-h-8 items-center gap-2 font-medium text-sm">
					<CollapsibleTrigger className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "-ml-2")}>
						<ChevronRight aria-hidden="true" className="transition-transform group-data-open/lane:rotate-90" />
						{lane}
					</CollapsibleTrigger>
					{count}
				</h2>
				<CollapsibleContent>{list}</CollapsibleContent>
			</Collapsible>
		);
	}
	return (
		<section aria-label={lane} className={cn("work-column min-w-0", className)}>
			<h2 className="m-0 mb-2 flex min-h-8 items-center justify-between gap-2 font-medium text-sm">
				{lane}
				{count}
			</h2>
			{list}
		</section>
	);
}

function LaneCards({
	lane,
	rows,
	...list
}: {
	readonly lane: NowLane;
	readonly rows: WorkProjection["rows"];
	readonly state: State;
	readonly fleet: ReadonlyMap<string, FleetWork>;
	readonly virtual: boolean;
	readonly bounded: boolean | undefined;
}) {
	if (rows.length === 0) {
		return (
			<EmptyState compact title={emptyLanes[lane].title}>
				{emptyLanes[lane].description}
			</EmptyState>
		);
	}
	return <WorkCardList inLane rows={rows} {...list} />;
}
