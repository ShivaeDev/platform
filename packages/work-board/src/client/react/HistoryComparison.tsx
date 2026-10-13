import { fileUrl } from "#files/url.ts";
import type { HistoryComparison as Comparison } from "#history/schema.ts";
export function HistoryComparison({ data }: { readonly data: Comparison }) {
	const counts = (["added", "removed", "changed"] as const)
		.map((kind) => `${data.changes.filter((change) => change.kind === kind).length} ${kind}`)
		.join(" · ");
	return (
		<>
			<p>
				Compared with your observation at <time>{data.recordedAt}</time>.
			</p>
			<p role="status">{counts}</p>
			{data.changes.length === 0 && <p>No source changes since that observation.</p>}
			{data.issues.length > 0 && (
				<aside aria-label="Identity limitations">
					<ul>
						{data.issues.map((issue) => (
							<li key={issue}>{issue}</li>
						))}
					</ul>
					<p>Ambiguous identities are compared by source path only.</p>
				</aside>
			)}
			{data.changes.map((change) => (
				<HistoryChange change={change} key={change.before?.file ?? change.after?.file} />
			))}
		</>
	);
}

function HistoryChange({ change }: { readonly change: Comparison["changes"][number] }) {
	const file = change.after?.file ?? change.before?.file ?? "";
	const key = change.before ? `before:${change.before.file}` : `added:${file}`;
	return (
		<article className="history-change" data-key={key}>
			<h2>
				{change.kind}: {file}
			</h2>
			{change.before && change.after && change.before.file !== file && <p>Previously {change.before.file}</p>}
			<ul>
				{change.reasons.map((reason) => (
					<li key={reason}>{reason}</li>
				))}
			</ul>
			{change.after ? <a href={fileUrl(change.after.file)}>Read current source</a> : <p>Removed source; no current document link.</p>}
			{Boolean(change.before) && (
				<details data-history-source="remembered" data-key={`${key}:Remembered`}>
					<summary>Remembered source (plain text)</summary>
					<pre className="history-source">{change.before?.source}</pre>
				</details>
			)}
			{Boolean(change.after) && (
				<details data-history-source="current" data-key={`${key}:Current`}>
					<summary>Current source (plain text)</summary>
					<pre className="history-source">{change.after?.source}</pre>
				</details>
			)}
		</article>
	);
}
