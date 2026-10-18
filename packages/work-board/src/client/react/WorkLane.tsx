import { useState } from "react";
import type { FleetWork, NowLane } from "#browser/views/now.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { Button } from "#client/react/components/ui/Button.tsx";
import { WorkCardList } from "#client/react/WorkCardList.tsx";

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
						variant="outline"
					>
						{lane}
					</Button>
				) : (
					lane
				)}
				<span className="work-count shrink-0 text-muted-foreground text-xs tabular-nums">{rows.length}</span>
			</h2>
			{Boolean(open) && <WorkCardList fleet={fleet} rows={rows} state={state} virtual={virtual} />}
		</section>
	);
}
