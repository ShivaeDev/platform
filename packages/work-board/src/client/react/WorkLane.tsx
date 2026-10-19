import { cn } from "cn";
import { ChevronRight } from "lucide-react";
import type { FleetWork, NowLane } from "#browser/views/now.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { buttonVariants } from "#client/react/components/ui/button.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#client/react/components/ui/collapsible.tsx";
import { WorkCardList } from "#client/react/WorkCardList.tsx";

export function WorkLane({
	lane,
	rows,
	state,
	fleet,
	virtual,
	collapsed,
	className,
	unavailable,
}: {
	readonly lane: NowLane;
	readonly rows: WorkProjection["rows"];
	readonly state: State;
	readonly fleet: ReadonlyMap<string, FleetWork>;
	readonly virtual: boolean;
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
			<LaneCards fleet={fleet} rows={rows} state={state} virtual={virtual} />
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
	rows,
	...list
}: {
	readonly rows: WorkProjection["rows"];
	readonly state: State;
	readonly fleet: ReadonlyMap<string, FleetWork>;
	readonly virtual: boolean;
}) {
	if (rows.length === 0) {
		return <p className="m-0 rounded-lg border border-dashed p-3 text-muted-foreground text-xs">Nothing here</p>;
	}
	return <WorkCardList rows={rows} {...list} />;
}
