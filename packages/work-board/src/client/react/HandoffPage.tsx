import type { HandoffProjection } from "#browser/views/remaining.ts";
import { fileUrl } from "#files/url.ts";
import { HandoffForm } from "./HandoffForm.tsx";
import { HandoffPrompt } from "./HandoffPrompt.tsx";
import { ResponseMarkdown } from "./ResponseMarkdown.tsx";
import { shellIds } from "./shellIds.ts";
export function HandoffPage({ data }: { readonly data: HandoffProjection }) {
	return (
		<section className="response-panel">
			<h1>Agent handoff · {data.item}</h1>
			<p>
				Prepare a Markdown file, then copy a tiny prompt into your existing agent session. Sessions may poll or wait for human answers. Agents record
				receipt with ordinary file edits.
			</p>
			{Boolean(data.source) && (
				<section className="response-context">
					<ResponseMarkdown file={data.source?.source ?? ""} source={data.background} />
				</section>
			)}
			<HandoffForm data={data} />
			<section id={shellIds.handoffHistory}>
				<h2>Prepared handoffs</h2>
				{data.reading.unknown.length > 0 && (
					<p role="status">
						Some handoff history is unavailable: {data.reading.unknown.join(", ")}. Missing records do not establish that no receipt exists.
					</p>
				)}
				{data.reading.records.length === 0 && <p>No readable handoff is recorded for this item.</p>}
				{data.reading.records.map((record) => (
					<HandoffEntry current={data.source} key={record.id} record={record} />
				))}
			</section>
		</section>
	);
}

function HandoffEntry({
	record,
	current,
}: {
	readonly record: HandoffProjection["reading"]["records"][number];
	readonly current: HandoffProjection["source"];
}) {
	const h = record.handoff;
	const same = current?.reviewedRevision === h.reviewedRevision && current.source === h.source;
	return (
		<article id={record.id}>
			<h3>
				<a href={fileUrl(record.file)}>{record.id}</a> · {h.recipient}
			</h3>
			<p>
				<b>Receipt: {h.state}</b>
				{h.state === "requested" ? " — prepared; receipt not confirmed" : ""}. Execution and acceptance are not recorded by this state.
			</p>
			<p>
				{same ? "Current reviewed source" : "Earlier or unavailable reviewed source; recheck before acting"} ·{" "}
				<a href={fileUrl(h.source)}>{h.source}</a> · <code>{h.reviewedRevision}</code>
			</p>
			{Boolean(h.by || h.note) && (
				<p>
					{h.by ?? "Attribution not recorded"}
					{h.note ? ` · ${h.note}` : ""}
				</p>
			)}
			<h4>Goal</h4>
			<ResponseMarkdown file={h.source} source={h.goal} />
			<h4>Constraints</h4>
			{h.constraints ? <ResponseMarkdown file={h.source} source={h.constraints} /> : <p>None recorded.</p>}
			<h4>Next action</h4>
			<ResponseMarkdown file={h.source} source={h.nextAction} />
			<HandoffPrompt id={record.id} prompt={record.prompt} />
			<details>
				<summary>Exact reviewed source snapshot</summary>
				<pre>{record.context}</pre>
			</details>
		</article>
	);
}
