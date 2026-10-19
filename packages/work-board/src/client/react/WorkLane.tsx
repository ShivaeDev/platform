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
}: {
	readonly lane: NowLane;
	readonly rows: WorkProjection["rows"];
	readonly state: State;
	readonly fleet: ReadonlyMap<string, FleetWork>;
	readonly virtual: boolean;
	readonly collapsed: boolean;
	readonly className?: string | undefined;
}) {
	const count = (
		<Badge className="work-count shrink-0 tabular-nums" variant="secondary">
			{rows.length}
		</Badge>
	);
	const list =
		rows.length > 0 ? (
			<WorkCardList fleet={fleet} rows={rows} state={state} virtual={virtual} />
		) : (
			<p className="m-0 rounded-lg border border-dashed p-3 text-muted-foreground text-xs">Nothing here</p>
		);
	if (collapsed) {
		return (
			<Collapsible
				render={
					<section
						aria-label={lane}
						className={cn("work-column group/lane min-w-0 data-open:min-w-60 data-open:flex-1 data-open:basis-0", className)}
					/>
				}
			>
				<h2 className="m-0 mb-2 flex min-h-8 items-center justify-between gap-2 font-medium text-sm">
					<CollapsibleTrigger
						className={buttonVariants({ className: "-ml-2 h-auto min-h-7 whitespace-normal text-left", size: "sm", variant: "ghost" })}
					>
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
