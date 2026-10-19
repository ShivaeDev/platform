import { FileText } from "lucide-react";
import type { Document } from "#browser/document/schema.ts";
import type { ResultProjection } from "#browser/views/ResultProjection.ts";
import { fileUrl } from "#files/url.ts";
import { responseUrl } from "#responses/url.ts";
import { DocumentMetadata } from "./DocumentMetadata.tsx";
import { LinkButton } from "./LinkButton.tsx";
import { LazyResponseMarkdown } from "./lazyMarkdown.tsx";
import { PageHeader } from "./PageHeader.tsx";
import { ReadingPanel } from "./ReadingPanel.tsx";
import { Reference } from "./Reference.tsx";
import { ResultCriteria } from "./ResultCriteria.tsx";
import { ResultFeedback, ResultFeedbackSummary } from "./ResultFeedback.tsx";
import { resultChecks } from "./resultChecks.ts";
import { SectionCard } from "./SectionCard.tsx";
import { StatusChip } from "./StatusChip.tsx";
import { shellIds } from "./shellIds.ts";
import { Time } from "./Time.tsx";
import { Version } from "./Version.tsx";

export function ResultPage({ data }: { readonly data: ResultProjection }) {
	const document = data.document;
	const reviews = openReviews(document);
	const checks = resultChecks(data);
	const empty = emptyLine(reviews.length === 0, checks.length === 0);
	return (
		<ReadingPanel>
			<PageHeader
				actions={<LinkButton href={fileUrl(document.file)}>Open file</LinkButton>}
				summary={<ResultSummary data={data} />}
				title="Review result"
			/>
			{reviews.length > 0 && <ResultReviews item={data.item} reviews={reviews} />}
			{checks.length > 0 && <ResultCriteria data={data} targets={checks} />}
			<div className="space-y-1 text-sm">
				{empty && (
					<p className="text-muted-foreground" data-result-empty>
						{empty}
					</p>
				)}
				<ResultFeedbackSummary data={data} />
			</div>
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
	const linked = (document.metadata.relationships ?? []).map((relationship) => relationship.target);
	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-2 text-foreground" data-result-summary>
				<FileText aria-hidden="true" className="size-4" />
				<span className="font-mono text-xs">{document.identity}</span>
				<StatusChip status={document.metadata.status} title="The agent sets this status itself. The Board doesn't check it." />
				<span className="text-muted-foreground text-xs">
					Version <Version revision={data.revision} />
				</span>
				<span className="text-muted-foreground text-xs">
					updated <Time at={document.modified} />
				</span>
			</div>
			{linked.length > 0 && (
				<ul className="list-none space-y-2" data-result-linked>
					{linked.map((target) => (
						<LinkedItem document={document} key={target} target={target} />
					))}
				</ul>
			)}
			<p className="m-0">An agent sent back this report. Read it, check the evidence, and answer if it asks for your review.</p>
		</div>
	);
}

function LinkedItem({ document, target }: { readonly document: Document; readonly target: string }) {
	const details = document.referenceDetails?.[target];
	return (
		<li className="flex flex-wrap items-center gap-x-3 gap-y-2 text-foreground">
			<span className="text-muted-foreground">For</span>
			<Reference document={document} target={target} />
			{details !== undefined && (
				<LinkButton
					aria-label={`Prepare follow-up handoff for ${details.title}`}
					href={`/_board/handoff?item=${encodeURIComponent(target.replace(/#.*$/u, ""))}`}
				>
					Prepare follow-up handoff
				</LinkButton>
			)}
		</li>
	);
}

function emptyLine(noReview: boolean, noChecks: boolean) {
	if (noReview && noChecks) {
		return "No review requested and no checks listed.";
	}
	if (noReview) {
		return "No review requested.";
	}
	return noChecks ? "No checks listed." : undefined;
}

type Review = NonNullable<Document["metadata"]["attention"]>[number];

function openReviews(document: Document): readonly Review[] {
	const requests = document.metadata.attention ?? [];
	return requests.filter(
		(entry) => entry.kind === "review" && entry.state === "open" && requests.filter((other) => other.id === entry.id).length === 1,
	);
}

function ResultReviews({ item, reviews }: { readonly item: string; readonly reviews: readonly Review[] }) {
	return (
		<SectionCard description="The agent is waiting for your answer." id={shellIds.resultActions} title="Your review">
			<ul className="list-none space-y-2 p-0">
				{reviews.map((entry) => (
					<ReviewRequest href={responseUrl(item, entry.id)} key={entry.id} reason={entry.reason} />
				))}
			</ul>
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
