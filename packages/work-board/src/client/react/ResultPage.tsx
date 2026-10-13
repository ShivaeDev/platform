import type { ResultProjection } from "#browser/views/ResultProjection.ts";
import { fileUrl } from "#files/url.ts";
import { DocumentMetadata } from "./DocumentMetadata.tsx";
import { ResponseMarkdown } from "./ResponseMarkdown.tsx";
import { ResultCriteria } from "./ResultCriteria.tsx";
import { ResultFeedback } from "./ResultFeedback.tsx";
import { shellIds } from "./shellIds.ts";
export function ResultPage({ data }: { readonly data: ResultProjection }) {
	const document = data.document;
	const requests = document.metadata.attention ?? [];
	const actions = requests.filter(
		(entry) => entry.kind === "review" && entry.state === "open" && requests.filter((other) => other.id === entry.id).length === 1,
	);
	const links = actions.map((entry) => (
		<li key={entry.id}>
			<a href={`/_board/respond?item=${encodeURIComponent(document.identity ?? "")}&request=${encodeURIComponent(entry.id)}`}>Review {entry.id}</a> —{" "}
			{entry.reason}
		</li>
	));
	return (
		<section className="response-panel">
			<h1>Review returned result · {document.identity}</h1>
			<p>
				Result status (source): <b>{document.metadata.status ?? "Not recorded"}</b>. This is a supplied claim, not an execution receipt or work
				acceptance.
			</p>
			<p>
				Current report SHA-256: <code>{data.revision}</code> · <a href={fileUrl(document.file)}>Read source</a>
			</p>
			<DocumentMetadata document={document} />
			<section id={shellIds.resultActions}>
				<h2>Respond to this report</h2>
				{actions.length > 0 ? (
					<ul>{links}</ul>
				) : (
					<p>
						No unique open review request is declared. The agent can add an explicit attention review and Markdown question packet with ordinary file
						editing. Work Board does not infer one from status.
					</p>
				)}
			</section>
			<ResultCriteria data={data} />
			<section id={shellIds.resultReport}>
				<h2>Report, evidence and limitations</h2>
				<ResponseMarkdown file={document.file} source={document.source} />
			</section>
			<ResultFeedback data={data} />
		</section>
	);
}
