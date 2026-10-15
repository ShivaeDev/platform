import type { FleetWork } from "#browser/views/now.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { useVirtualRows } from "./useVirtualRows.ts";
import { WorkCard } from "./WorkCard.tsx";

export function WorkCardList({
	rows,
	state,
	fleet,
	virtual,
}: {
	readonly rows: WorkProjection["rows"];
	readonly state: State;
	readonly fleet: ReadonlyMap<string, FleetWork>;
	readonly virtual: boolean;
}) {
	const window = useVirtualRows(rows.length, 224, virtual);
	return (
		<section aria-label="Lane items" className="work-card-list" onScroll={window.onScroll}>
			<div style={{ paddingBottom: window.bottom, paddingTop: window.top }}>
				{rows.slice(window.start, window.end).map((item) => (
					<div className="work-card-slot" key={item.id}>
						<WorkCard fleet={fleet.get(item.id)} item={item} state={state} />
					</div>
				))}
			</div>
		</section>
	);
}
