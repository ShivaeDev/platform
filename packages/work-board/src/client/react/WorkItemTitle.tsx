import type { WorkProjection } from "#browser/views/schema.ts";
import { type State, viewUrl } from "#browser/views/state.ts";
export function WorkItemTitle({
	item,
	state,
	className,
}: {
	readonly item: WorkProjection["rows"][number];
	readonly state: State;
	readonly className?: string | undefined;
}) {
	return (
		<a aria-current={item.id === state.item ? "true" : undefined} className={className} href={viewUrl(state, { item: item.id }, "work-detail")}>
			{item.title}
		</a>
	);
}
