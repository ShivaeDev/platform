import type { InboxProjection } from "#browser/views/schema.ts";
import { Age } from "./Age.tsx";
export function InboxPage({ data }: { readonly data: InboxProjection }) {
	return (
		<>
			<header className="work-head">
				<p className="work-eyebrow">WORKSPACE · INBOX</p>
				<h1>Inbox</h1>
				<p>Questions and work waiting on a person. Oldest changed source first.</p>
			</header>
			<p className="work-total" role="status">
				{data.complete ? `${data.you.length} waiting` : "Count unavailable"}
			</p>
			<section aria-label="Waiting on you" className="inbox-list">
				<h2>Waiting on you</h2>
				<InboxContent data={data} />
			</section>
			<InboxGroup items={data.agents} title="Waiting on agents" />
			<InboxGroup items={data.resolved} title="Resolved elsewhere" />
			<InboxGroup items={data.parked} title="Parked" />
		</>
	);
}
function InboxContent({ data }: { readonly data: InboxProjection }) {
	if (!data.complete) {
		return <p role="status">Workspace incomplete. Inbox membership and count are unavailable.</p>;
	}
	if (data.you.length === 0) {
		return (
			<p className="empty">
				{data.sourceIssues ? "No classified waiting items. Check source issues in Overview." : "All quiet — nothing is waiting on a person."}
			</p>
		);
	}
	return data.you.map((item) => <InboxRow item={item} key={`${item.file}:${item.href}`} />);
}
function InboxGroup({ items, title }: { readonly items: InboxProjection["you"]; readonly title: string }) {
	return items.length > 0 ? (
		<details className="inbox-group">
			<summary>
				{title} ({items.length})
			</summary>
			{items.map((item) => (
				<InboxRow item={item} key={`${item.file}:${item.href}`} />
			))}
		</details>
	) : null;
}
function InboxRow({ item }: { readonly item: InboxProjection["you"][number] }) {
	return (
		<article className="inbox-row">
			<div>
				<h3>
					<a href={item.href}>{item.title}</a>
				</h3>
				<p>{item.reason}</p>
				{item.responseFrom !== undefined && <p>Response needed from: {item.responseFrom.join(", ")}</p>}
				{Boolean(item.earlierAsks) && (
					<p>
						{item.earlierAsks} earlier {item.earlierAsks === 1 ? "ask" : "asks"}
					</p>
				)}
				{Boolean(item.problem) && (
					<p className="inbox-problem" role="status">
						{item.problem} — open the source to resolve it.
					</p>
				)}
			</div>
			<p className="inbox-age">{item.modified === undefined ? "Age unavailable" : <Age modified={item.modified} />}</p>
		</article>
	);
}
