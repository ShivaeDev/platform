import type { OverviewProjection } from "#browser/views/schema.ts";
import { fileUrl } from "#files/url.ts";

const groups = [
	{ empty: "No open decision requests.", kind: "decision", title: "Decisions" },
	{ empty: "No open review requests.", kind: "review", title: "Reviews" },
	{ empty: "No open blocker requests.", kind: "blocker", title: "Blockers" },
];
export function OverviewGroups({ entries }: { readonly entries: OverviewProjection["entries"] }) {
	return (
		<div className="attention-groups">
			{groups.map((group) => (
				<Group entries={entries.filter((entry) => entry.kind === group.kind)} group={group} key={group.kind} />
			))}
		</div>
	);
}
function Group({ entries, group }: { readonly entries: OverviewProjection["entries"]; readonly group: (typeof groups)[number] }) {
	return (
		<section aria-labelledby={`attention-${group.kind}`} className="attention-group">
			<h2 id={`attention-${group.kind}`} tabIndex={-1}>
				{group.title}
				<span>{entries.length}</span>
			</h2>
			{entries.length === 0 ? (
				<p className="empty">{group.empty}</p>
			) : (
				entries.map((entry) => <Card entry={entry} key={`${entry.itemId}:${entry.id}`} />)
			)}
		</section>
	);
}
function Card({ entry }: { readonly entry: OverviewProjection["entries"][number] }) {
	const links = entry.unblocks.map((link, index) => (
		<span key={link.label}>
			{index > 0 && ", "}
			{link.href ? <a href={link.href}>{link.label}</a> : link.label}
		</span>
	));
	return (
		<article className="attention-card" data-attention-item={entry.itemId} data-request={entry.id}>
			<p className="work-kind">{entry.kind} request</p>
			<h3>
				<a href={entry.href}>{entry.title}</a>
			</h3>
			<p className="work-id">
				{entry.itemId} / {entry.id}
			</p>
			<p className="attention-reason">{entry.reason}</p>
			<dl>
				<dt>Response needed from</dt>
				<dd>{entry.responseFrom.join(", ")}</dd>
				<dt>Recorded to unblock</dt>
				<dd>{links}</dd>
			</dl>
			<a className="attention-source" href={`${fileUrl(entry.file)}#attention-request-${encodeURIComponent(entry.id)}`}>
				Source: {entry.file}:{entry.line}
			</a>
		</article>
	);
}
