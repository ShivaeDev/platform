import { useState } from "react";
import type { FleetWork, NowLane } from "#browser/views/now.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { Button } from "#client/react/components/ui/button.tsx";
import { EmptyState } from "#client/react/EmptyState.tsx";
import { WorkCardList } from "#client/react/WorkCardList.tsx";

const emptyLanes: Readonly<Record<NowLane, { readonly title: string; readonly description: string }>> = {
	Delivering: { description: "Work that Fleet is merging appears here.", title: "Nothing delivering" },
	"Done in the last 7 days": { description: "Work finished in the last 7 days appears here.", title: "Nothing done this week" },
	Executing: { description: "Work an agent is building appears here.", title: "Nothing executing" },
	Queued: { description: "Approved work waits here until an agent starts it.", title: "Nothing queued" },
	Reviewing: { description: "Work under review appears here.", title: "Nothing in review" },
	"Waiting on a person": { description: "Work that needs a person's answer appears here.", title: "Nothing waiting on a person" },
};

export function WorkLane({
	lane,
	rows,
	state,
	fleet,
	virtual,
	collapsed,
}: {
	readonly lane: NowLane;
	readonly rows: WorkProjection["rows"];
	readonly state: State;
	readonly fleet: ReadonlyMap<string, FleetWork>;
	readonly virtual: boolean;
	readonly collapsed: boolean;
}) {
	const [open, setOpen] = useState(!collapsed);
	return (
		<section aria-label={lane} className="work-column min-w-0">
			<h2 className="m-0 mb-3 flex min-h-8 items-center justify-between gap-2 font-semibold text-sm">
				{collapsed ? (
					<Button
						aria-expanded={open}
						className="h-auto min-h-8 shrink whitespace-normal text-left"
						onClick={() => setOpen(!open)}
						size="sm"
						type="button"
						variant="outline"
					>
						{lane}
					</Button>
				) : (
					lane
				)}
				<span className="work-count shrink-0 text-muted-foreground text-xs tabular-nums">{rows.length}</span>
			</h2>
			{Boolean(open) && rows.length > 0 && <WorkCardList fleet={fleet} rows={rows} state={state} virtual={virtual} />}
			{Boolean(open) && rows.length === 0 && (
				<EmptyState compact title={emptyLanes[lane].title}>
					{emptyLanes[lane].description}
				</EmptyState>
			)}
		</section>
	);
}
