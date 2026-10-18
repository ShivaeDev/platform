import type { ResultProjection } from "#browser/views/ResultProjection.ts";
import { fileUrl } from "#files/url.ts";
import { responseUrl } from "#responses/url.ts";
import { DocumentMetadata } from "./DocumentMetadata.tsx";
import { LinkButton } from "./LinkButton.tsx";
import { PageHeader } from "./PageHeader.tsx";
import { ReadingPanel } from "./ReadingPanel.tsx";
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
			<a href={responseUrl(document.identity ?? "", entry.id)}>Review {entry.id}</a> — {entry.reason}
		</li>
	));
	return (
		<ReadingPanel className="response-panel">
			<PageHeader
				actions={<LinkButton href={fileUrl(document.file)}>Read source</LinkButton>}
				summary={
					<>
						<div title="A supplied claim does not establish execution or work acceptance.">
							Result status: <b>{document.metadata.status}</b>
						</div>
						<div>
							Current report SHA-256: <code>{data.revision}</code>
						</div>
					</>
				}
				title={`Review returned result · ${document.identity}`}
			/>
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
		</ReadingPanel>
	);
}
