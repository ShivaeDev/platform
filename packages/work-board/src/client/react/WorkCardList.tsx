import { cn } from "cn";
import type { FleetWork } from "#browser/views/now.ts";
import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { useVirtualRows } from "./useVirtualRows.ts";
import { WorkCard } from "./WorkCard.tsx";

// The shortest card's pitch, so the rendered window always reaches the bottom of the view.
const CARD_HEIGHT = 80;

export function WorkCardList({
	rows,
	state,
	fleet,
	virtual,
	bounded = false,
	inLane = false,
}: {
	readonly rows: WorkProjection["rows"];
	readonly state: State;
	readonly fleet: ReadonlyMap<string, FleetWork>;
	readonly virtual: boolean;
	readonly bounded?: boolean | undefined;
	readonly inLane?: boolean;
}) {
	const window = useVirtualRows<HTMLElement>(rows.length, CARD_HEIGHT, virtual, bounded);
	return (
		<section
			aria-label="Lane items"
			className={cn(
				"work-card-list min-h-0 rounded-lg bg-muted/40 p-2",
				bounded && "max-h-[calc(100dvh-16rem)] overflow-y-auto overscroll-contain",
				// Scroll anchoring would chase the estimated padding as the window moves and leave the view blank.
				virtual && !bounded && "[overflow-anchor:none]",
			)}
			onScroll={bounded ? window.onScroll : undefined}
			ref={window.ref}
		>
			<div className="flex flex-col gap-2" style={{ paddingBottom: window.bottom, paddingTop: window.top }}>
				{rows.slice(window.start, window.end).map((item) => (
					<WorkCard fleet={fleet.get(item.id)} inLane={inLane} item={item} key={item.id} state={state} />
				))}
			</div>
		</section>
	);
}
