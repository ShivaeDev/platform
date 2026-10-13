import type { InboxProjection } from "#browser/views/schema.ts";
export function InboxPage({ data }: { readonly data: InboxProjection }) {
	return (
		<>
			<header className="work-head">
				<p className="work-eyebrow">WORKSPACE · INBOX</p>
				<h1>Inbox</h1>
				<p>Questions and work waiting on a person. Oldest changed source first.</p>
			</header>
			<p className="work-total" role="status">
				{data.complete ? `${data.items.length} waiting` : "Count unavailable"}
			</p>
			<section aria-label="Waiting on you" className="inbox-list">
				<h2>Waiting on you</h2>
				<InboxContent data={data} />
			</section>
		</>
	);
}
function InboxContent({ data }: { readonly data: InboxProjection }) {
	if (!data.complete) {
		return <p role="status">Workspace incomplete. Inbox membership and count are unavailable.</p>;
	}
	if (data.items.length === 0) {
		return (
			<p className="empty">
				{data.sourceIssues ? "No classified waiting items. Check source issues in Overview." : "All quiet — nothing is waiting on a person."}
			</p>
		);
	}
	return data.items.map((item) => <InboxRow item={item} key={item.file} />);
}
function InboxRow({ item }: { readonly item: InboxProjection["items"][number] }) {
	return (
		<article className="inbox-row">
			<div>
				<h3>
					<a href={item.href}>{item.title}</a>
				</h3>
				<p>{item.reason}</p>
				{Boolean(item.problem) && (
					<p className="inbox-problem" role="status">
						{item.problem} — open the source to resolve it.
					</p>
				)}
			</div>
			<p className="inbox-age">
				{item.modified === undefined ? (
					"Age unavailable"
				) : (
					<span className="age" data-modified={item.modified}>
						updated {new Date(item.modified).toISOString()}
					</span>
				)}
			</p>
		</article>
	);
}
