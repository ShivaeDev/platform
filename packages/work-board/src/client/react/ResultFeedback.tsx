import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { ResultProjection } from "#browser/views/ResultProjection.ts";
import { statusLabel } from "#browser/views/statusLabel.ts";
import { Alert, AlertDescription, AlertTitle } from "#client/react/components/ui/alert.tsx";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { fileUrl } from "#files/url.ts";
import { EmptyState } from "./EmptyState.tsx";
import { LazyResponseMarkdown } from "./lazyMarkdown.tsx";
import { responseKinds } from "./responseKinds.ts";
import { SectionCard } from "./SectionCard.tsx";
import { shellIds } from "./shellIds.ts";
import { Time } from "./Time.tsx";
import { Version } from "./Version.tsx";

export function ResultFeedback({ data }: { readonly data: ResultProjection }) {
	let body = data.feedback.map((entry) => <FeedbackEntry entry={entry} key={entry.response.id} />);
	if (data.feedbackUnknown) {
		body = [
			<Alert key="unknown">
				<CircleAlert aria-hidden="true" />
				<AlertTitle>Some feedback couldn't be read</AlertTitle>
				<AlertDescription>There may be feedback that isn't shown here. Check the response files before relying on this list.</AlertDescription>
			</Alert>,
		];
	} else if (body.length === 0) {
		body = [
			<EmptyState key="none" title="No feedback yet">
				Feedback recorded on this result appears here.
			</EmptyState>,
		];
	}
	return (
		<SectionCard
			description="Each answer applies to the report version it was written for. An answer, even an acceptance, doesn't change the work's status."
			id={shellIds.resultFeedback}
			title="Feedback"
		>
			{body}
		</SectionCard>
	);
}

export function ResultFeedbackSummary({ data }: { readonly data: ResultProjection }) {
	const latest = data.feedback[0];
	let summary: ReactNode = "No feedback yet.";
	if (data.feedbackUnknown) {
		summary = "Some feedback couldn't be read.";
	} else if (latest) {
		const count = data.feedback.length;
		summary = (
			<>
				{count === 1 ? "1 response" : `${count} responses`}. Latest: {latest.response.response.author} {responseKinds[latest.response.response.type]}{" "}
				<Time at={latest.response.response.recordedAt} />
				{latest.matching ? "" : " on an earlier version"}.
			</>
		);
	}
	return (
		<p className="text-muted-foreground" data-feedback-summary>
			<span className="font-medium text-foreground">Feedback: </span>
			{summary}
			{(data.feedbackUnknown || latest !== undefined) && (
				<>
					{" "}
					<a href={`#${shellIds.resultFeedback}`}>Jump to feedback</a>
				</>
			)}
		</p>
	);
}

function FeedbackEntry({ entry }: { readonly entry: ResultProjection["feedback"][number] }) {
	const { response, question, responseFile, questionFile, supersedesFile, matching } = entry;
	return (
		<article className="min-w-0 space-y-3 rounded-lg border p-4" data-matching={matching} id={response.id}>
			<header className="flex flex-wrap items-center gap-2">
				<h3 className="m-0 font-semibold text-sm">{response.response.author}</h3>
				<Badge variant="secondary">{statusLabel(response.response.type)}</Badge>
				<Badge variant="outline">{matching ? "This version" : "Earlier version"}</Badge>
			</header>
			<p className="m-0 text-muted-foreground">
				{matching
					? "Written for the version of the report shown here."
					: "Written for an earlier or moved version of this report. It doesn't apply to this version automatically."}{" "}
				Reviewed <a href={fileUrl(question.question.source)}>{question.question.source}</a> at version{" "}
				<Version revision={question.question.reviewedRevision} />.
			</p>
			{response.response.answers !== undefined && response.response.answers.length > 0 && (
				<p className="m-0">
					Chose {response.response.answers.map((answer) => `${answer.prompt}: ${answer.selected.join(", ") || "written answer only"}`).join("; ")}.
				</p>
			)}
			{Boolean(response.response.supersedes) && (
				<p className="m-0">
					Replaces earlier feedback <a href={fileUrl(supersedesFile ?? "")}>{response.response.supersedes}</a>.
				</p>
			)}
			<div className="reading-column">
				<LazyResponseMarkdown file={responseFile} source={response.body} />
			</div>
			<details className="rounded-md border px-3 py-2">
				<summary className="cursor-pointer font-medium">Report as reviewed</summary>
				<pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">{question.context}</pre>
			</details>
			<p className="m-0 text-muted-foreground text-xs">
				<a href={fileUrl(responseFile)}>Response file</a> · <a href={fileUrl(questionFile)}>Question file</a>
			</p>
		</article>
	);
}
