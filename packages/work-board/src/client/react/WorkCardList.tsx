import type { FleetWork } from "#browser/views/now.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { useVirtualRows } from "./useVirtualRows.ts";
import { WorkCard } from "./WorkCard.tsx";

const CARD_HEIGHT = 132;

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
	const window = useVirtualRows(rows.length, CARD_HEIGHT, virtual);
	return (
		<section
			aria-label="Lane items"
			className="work-card-list max-h-[calc(100dvh-16rem)] min-h-0 overflow-y-auto overscroll-contain rounded-lg bg-muted/40 p-2 max-md:max-h-[min(70dvh,600px)]"
			onScroll={window.onScroll}
		>
			<div className="flex flex-col gap-2" style={{ paddingBottom: window.bottom, paddingTop: window.top }}>
				{rows.slice(window.start, window.end).map((item) => (
					<WorkCard fleet={fleet.get(item.id)} item={item} key={item.id} state={state} />
				))}
			</div>
		</section>
	);
}
