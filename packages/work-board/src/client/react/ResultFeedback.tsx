import { CircleAlert } from "lucide-react";
import type { ResultProjection } from "#browser/views/ResultProjection.ts";
import { statusLabel } from "#browser/views/statusLabel.ts";
import { Alert, AlertDescription, AlertTitle } from "#client/react/components/ui/alert.tsx";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { fileUrl } from "#files/url.ts";
import { LazyResponseMarkdown } from "./lazyMarkdown.tsx";
import { SectionCard } from "./SectionCard.tsx";
import { shellIds } from "./shellIds.ts";
import { SOURCE_PROBLEMS_ID } from "./sourceProblems.ts";
import { Time } from "./Time.tsx";

export function ResultFeedback({ data }: { readonly data: ResultProjection }) {
	return (
		<SectionCard
			description="Each answer applies to the report version it was written for. An answer, even an acceptance, doesn't change the work's status."
			id={shellIds.resultFeedback}
			title="Feedback"
		>
			{data.unreadableFeedback.length > 0 ? (
				<UnreadableFeedback files={data.unreadableFeedback} />
			) : (
				data.feedback.map((entry) => <FeedbackEntry entry={entry} key={entry.response.id} received={data.document.modified} />)
			)}
		</SectionCard>
	);
}

function UnreadableFeedback({ files }: { readonly files: ResultProjection["unreadableFeedback"] }) {
	return (
		<Alert>
			<CircleAlert aria-hidden="true" />
			<AlertTitle>Some feedback couldn't be read</AlertTitle>
			<AlertDescription>
				<p>Feedback in these files isn't shown, so this list may be incomplete.</p>
				<ul className="list-disc space-y-1 pl-5" data-unreadable-feedback>
					{files.map(({ file, reason }) => (
						<UnreadableFile file={file} key={`${file}\0${reason}`} reason={reason} />
					))}
				</ul>
				<p>
					<a href={`/_board/system#${SOURCE_PROBLEMS_ID}`}>See source problems in System</a>
				</p>
			</AlertDescription>
		</Alert>
	);
}

function UnreadableFile({ file, reason }: { readonly file: string; readonly reason: string }) {
	return (
		<li>
			<a className="font-mono text-xs" href={fileUrl(file)}>
				{file}
			</a>
			: {reason}
		</li>
	);
}

function FeedbackEntry({ entry, received }: { readonly entry: ResultProjection["feedback"][number]; readonly received: number }) {
	const { response, question, responseFile, questionFile, supersedesFile, matching } = entry;
	const source = <a href={fileUrl(question.question.source)}>{question.question.source}</a>;
	return (
		<article className="min-w-0 space-y-3 rounded-lg border p-4" data-matching={matching} id={response.id}>
			<header className="flex flex-wrap items-center gap-2">
				<h3 className="m-0 text-sm font-semibold">{response.response.author}</h3>
				<Badge variant="secondary">{statusLabel(response.response.type)}</Badge>
				<Badge variant="outline">{matching ? "This version" : "Earlier version"}</Badge>
			</header>
			<p className="text-muted-foreground m-0" data-reviewed-version>
				{matching ? (
					<>
						Written for the version of {source} shown here, received <Time at={received} />.
					</>
				) : (
					<>
						Written for an earlier or moved version of {source}, as it was <Time at={question.question.registeredAt} />. It doesn't apply to this
						version automatically.
					</>
				)}
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
				<p className="text-muted-foreground mt-2 mb-0 text-xs">
					SHA-256 <code className="font-mono break-all select-all">{question.question.reviewedRevision}</code>
				</p>
				<pre className="bg-muted mt-2 max-h-96 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">{question.context}</pre>
			</details>
			<p className="text-muted-foreground m-0 text-xs">
				<a href={fileUrl(responseFile)}>Response file</a> · <a href={fileUrl(questionFile)}>Question file</a>
			</p>
		</article>
	);
}
