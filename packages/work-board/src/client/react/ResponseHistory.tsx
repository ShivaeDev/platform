import type { DocumentRequest } from "#browser/document/schema.ts";
import { ResponseMarkdown } from "./ResponseMarkdown.tsx";
import { shellIds } from "./shellIds.ts";
export function ResponseHistory({ request }: { readonly request: DocumentRequest | undefined }) {
	const records = request?.responses ?? [];
	const preview = request?.preview;
	return (
		<section id={shellIds.responseHistory}>
			<h2>Recorded responses</h2>
			{records.length === 0 ? (
				<p>No response is recorded for this source revision.</p>
			) : (
				records.map((record) => <ResponseEntry current={record.response.question === preview?.id} key={record.id} record={record} />)
			)}
		</section>
	);
}
function ResponseEntry({ record, current }: { readonly record: import("#browser/responses/schema.ts").RecordedResponse; readonly current: boolean }) {
	return (
		<article id={record.id}>
			<h3>
				<a href={`/responses/${record.id}.md`}>
					{record.response.author} · {record.response.type}
				</a>
			</h3>
			<p>
				{current ? "This reviewed revision" : "Earlier reviewed context — does not approve the current source"} ·{" "}
				<code>{record.response.reviewedRevision}</code>
			</p>
			{Boolean(record.response.supersedes) && (
				<p>
					Explicitly supersedes <a href={`/responses/${record.response.supersedes}.md`}>{record.response.supersedes}</a>.
				</p>
			)}
			<ResponseMarkdown file={`responses/${record.id}.md`} source={record.body} />
		</article>
	);
}
