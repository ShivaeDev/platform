import type { WorkProjection } from "#browser/views/schema.ts";
import type { State } from "#browser/views/state.ts";
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
				{status ?? "Status not recorded"} <span className="work-count">{items.length}</span>
			</h2>
			{items.map((item) => (
				<Card item={item} key={item.id} state={state} />
			))}
		</section>
	);
}
function Card({ item, state }: { readonly item: WorkProjection["rows"][number]; readonly state: State }) {
	return (
		<article className="work-card" data-item={item.id} data-selected={item.id === state.item ? "true" : undefined}>
			{Boolean(item.waiting) && (
				<span className="waiting-badge" title={item.waiting}>
					Waiting on you
				</span>
			)}
			<p className="work-kind">{item.metadata.kind ?? "Kind not recorded"}</p>
			<h3>
				<WorkItemTitle item={item} state={state} />
			</h3>
			<p className="work-id">{item.id}</p>
			<p className="work-owner">Owner: {item.metadata.owner ?? "Not recorded"}</p>
			{Boolean(item.metadata.nextAction) && <p className="work-next">Next: {item.metadata.nextAction}</p>}
		</article>
	);
}
