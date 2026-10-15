import { useState } from "react";
import type { FleetWork, NowLane } from "#browser/views/now.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { WorkCardList } from "./WorkCardList.tsx";

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
		<section aria-label={lane} className="work-column">
			<h2>
				{collapsed ? (
					<button aria-expanded={open} onClick={() => setOpen(!open)} type="button">
						{lane}
					</button>
				) : (
					lane
				)}
				<span className="work-count">{rows.length}</span>
			</h2>
			{Boolean(open) && <WorkCardList fleet={fleet} rows={rows} state={state} virtual={virtual} />}
		</section>
	);
}
