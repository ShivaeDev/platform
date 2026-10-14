import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
import { Card as Surface } from "#client/react/components/ui/Card.tsx";
import { StatusChip } from "#client/react/components/ui/StatusChip.tsx";
import { WorkItemTitle } from "./WorkItemTitle.tsx";
export function WorkCards({ data }: { readonly data: WorkProjection }) {
	const columns = [...Map.groupBy(data.rows, (item) => item.metadata.status)].map(([status, items]) => (
		<Column items={items} key={status ?? ""} state={data.state} status={status} />
	));
	return <div className="work-columns">{columns}</div>;
}
function Column({ items, state, status }: { readonly items: WorkProjection["rows"]; readonly state: State; readonly status: string | undefined }) {
	return (
		<section aria-label={status ?? "Status not recorded"} className="work-column">
			<h2>
				<StatusChip status={status} /> <span className="work-count">{items.length}</span>
			</h2>
			{items.map((item) => (
				<Card item={item} key={item.id} state={state} />
			))}
		</section>
	);
}
function Card({ item, state }: { readonly item: WorkProjection["rows"][number]; readonly state: State }) {
	return (
		<Surface
			className="work-card mb-3 break-words data-[selected=true]:ring-2 data-[selected=true]:ring-ring"
			data-item={item.id}
			data-selected={item.id === state.item ? "true" : undefined}
		>
			{Boolean(item.waiting) && <StatusChip status="needs-you" title={item.waiting} />}
			<p className="work-kind">{item.metadata.kind ?? "Kind not recorded"}</p>
			<h3>
				<WorkItemTitle item={item} state={state} />
			</h3>
			<p className="work-id">{item.id}</p>
			<p className="work-owner">Owner: {item.metadata.owner ?? "Not recorded"}</p>
			{Boolean(item.metadata.nextAction) && <p className="work-next">Next: {item.metadata.nextAction}</p>}
		</Surface>
	);
}
