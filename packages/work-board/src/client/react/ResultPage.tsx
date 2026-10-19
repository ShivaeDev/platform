import { FileText } from "lucide-react";
import type { ResultProjection } from "#browser/views/ResultProjection.ts";
import { fileUrl } from "#files/url.ts";
import { responseUrl } from "#responses/url.ts";
import { DocumentMetadata } from "./DocumentMetadata.tsx";
import { LinkButton } from "./LinkButton.tsx";
import { LazyResponseMarkdown } from "./lazyMarkdown.tsx";
import { PageHeader } from "./PageHeader.tsx";
import { ReadingPanel } from "./ReadingPanel.tsx";
import { ResultCriteria } from "./ResultCriteria.tsx";
import { ResultFeedback } from "./ResultFeedback.tsx";
import { SectionCard } from "./SectionCard.tsx";
import { StatusChip } from "./StatusChip.tsx";
import { shellIds } from "./shellIds.ts";
import { Version } from "./Version.tsx";

export function ResultPage({ data }: { readonly data: ResultProjection }) {
	const document = data.document;
	return (
		<ReadingPanel>
			<PageHeader
				actions={<LinkButton href={fileUrl(document.file)}>Open file</LinkButton>}
				summary={<ResultSummary data={data} />}
				title="Review result"
			/>
			<ResultReviews data={data} />
			<ResultCriteria data={data} />
			<section aria-labelledby={`${shellIds.resultReport}-title`} className="min-w-0" id={shellIds.resultReport}>
				<h2 className="mb-2 font-medium text-muted-foreground text-sm" id={`${shellIds.resultReport}-title`}>
					Report
				</h2>
				<div className="reading-column max-w-[68ch] text-base leading-[1.65] [&>:first-child]:mt-0 [&_h1]:text-2xl">
					<LazyResponseMarkdown file={document.file} source={document.source} />
				</div>
			</section>
			<ResultFeedback data={data} />
			<details className="item-context rounded-lg border bg-card px-4 py-3 text-sm">
				<summary className="cursor-pointer font-medium">Links and file details</summary>
				<DocumentMetadata document={document} />
			</details>
		</ReadingPanel>
	);
}

function ResultSummary({ data }: { readonly data: ResultProjection }) {
	const document = data.document;
	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-2 text-foreground" data-result-summary>
				<FileText aria-hidden="true" className="size-4" />
				<span className="font-mono text-xs">{document.identity}</span>
				<StatusChip status={document.metadata.status} title="The agent sets this status itself. The Board doesn't check it." />
				<span className="text-muted-foreground text-xs">
					Version <Version revision={data.revision} />
				</span>
			</div>
			<p className="m-0">An agent sent back this report. Read it, check the evidence, and answer if it asks for your review.</p>
		</div>
	);
}

function ResultReviews({ data }: { readonly data: ResultProjection }) {
	const document = data.document;
	const requests = document.metadata.attention ?? [];
	const reviews = requests.filter(
		(entry) => entry.kind === "review" && entry.state === "open" && requests.filter((other) => other.id === entry.id).length === 1,
	);
	return (
		<SectionCard
			description={
				reviews.length > 0
					? "The agent is waiting for your answer."
					: "No review is requested yet. The agent asks for one by adding a review request to this report; the Board doesn't guess from its status."
			}
			id={shellIds.resultActions}
			title="Your review"
		>
			{reviews.length > 0 ? (
				<ul className="list-none space-y-2 p-0">
					{reviews.map((entry) => (
						<ReviewRequest href={responseUrl(document.identity ?? "", entry.id)} key={entry.id} reason={entry.reason} />
					))}
				</ul>
			) : null}
		</SectionCard>
	);
}

function ReviewRequest({ href, reason }: { readonly href: string; readonly reason: string }) {
	return (
		<li className="flex flex-wrap items-center justify-between gap-2">
			<span>{reason}</span>
			<LinkButton href={href} variant="default">
				Answer
			</LinkButton>
		</li>
	);
}
