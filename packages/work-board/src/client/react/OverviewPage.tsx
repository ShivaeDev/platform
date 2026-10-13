import type { OverviewProjection } from "#browser/views/schema.ts";
import { fileUrl } from "#files/url.ts";
import { keyed } from "./keyed.ts";
import { OverviewGroups } from "./OverviewGroups.tsx";

export function OverviewPage({ data }: { readonly data: OverviewProjection }) {
	let summary = data.inboxCount > 0 ? "No explicit open attention requests recorded." : "All quiet — no explicit open requests recorded.";
	if (data.entries.length > 0) {
		summary = `${data.entries.length} validated open request${data.entries.length === 1 ? "" : "s"}`;
	} else if (data.issues.length > 0) {
		summary = "No validated open requests. Check unresolved source issues before treating this workspace as quiet.";
	}
	const issues = data.issues.length > 0 && (
		<details className="view-issues">
			<summary>Unclassified requests and source issues ({data.issues.length})</summary>
			<p>Ambiguous or invalid requests stay outside the queues. Read their original sources.</p>
			<ul>
				{keyed(data.issues, (issue) => `${issue.file}:${issue.line}:${issue.message}`).map(({ key, value: issue }) => (
					<li key={key}>
						<a href={fileUrl(issue.file)}>
							{issue.file}:{issue.line}
						</a>{" "}
						— {issue.message}
					</li>
				))}
			</ul>
		</details>
	);
	return (
		<>
			<header className="work-head">
				<p className="work-eyebrow">WORKSPACE · OVERVIEW</p>
				<h1>What needs a response?</h1>
				<p>Choose a recorded request to read its context, reasoning and evidence.</p>
				<a href="/_board/work?view=board">Browse all work</a>
			</header>
			{data.complete ? (
				<>
					<section aria-label="Inbox summary">
						<h2>Inbox</h2>
						<p>
							{data.inboxCount} waiting · <a href="/_board/inbox">Open Inbox</a>
						</p>
					</section>
					<p className="attention-total" role="status">
						{summary}
					</p>
					<p className="attention-order">
						Decisions, reviews, then blockers. Within each group: source title, item ID, request ID. Recipients are recorded labels.
					</p>
					{issues}
					<OverviewGroups entries={data.entries} />
					<p className="attention-footnote">
						These are authored requests. Closing one does not verify evidence or record an answer. The Inbox also shows human-owned next actions and
						questions; file activity and finished runs do not create requests.
					</p>
				</>
			) : (
				<>
					<p className="attention-incomplete" role="status">
						Workspace incomplete. Could not read {data.unavailable.join(", ")}. Requests are not counted or classified until the index is complete.
					</p>
					{issues}
				</>
			)}
		</>
	);
}
