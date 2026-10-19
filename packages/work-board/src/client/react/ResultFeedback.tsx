import type { ResultProjection } from "#browser/views/ResultProjection.ts";
import { fileUrl } from "#files/url.ts";
import { LazyResponseMarkdown } from "./lazyMarkdown.tsx";
import { shellIds } from "./shellIds.ts";
export function ResultFeedback({ data }: { readonly data: ResultProjection }) {
	return (
		<section id={shellIds.resultFeedback}>
			<h2>Recorded human feedback</h2>
			{data.feedbackUnknown ? (
				<p role="status">
					Response history is unknown or ambiguous. Unreadable records do not establish that no feedback exists. Read the source files before relying
					on it.
				</p>
			) : (
				<>
					<p>
						Human direction is pinned to its reviewed report. Option IDs and authored acceptance text are not a computed verified-acceptance state.
						Completing a run or receiving feedback does not change work status.
					</p>
					{data.feedback.length === 0 && <p>No readable response is recorded for this result.</p>}
					{data.feedback.map((entry) => (
						<FeedbackEntry entry={entry} key={entry.response.id} />
					))}
				</>
			)}
		</section>
	);
}

function FeedbackEntry({ entry }: { readonly entry: ResultProjection["feedback"][number] }) {
	const { response, question, responseFile, questionFile, supersedesFile, matching } = entry;
	return (
		<article id={response.id}>
			<h3>
				{response.response.author} · {response.response.type}
			</h3>
			<p>
				<b>
					{matching ? "Feedback on this exact result revision" : "Earlier or moved result context — does not apply automatically to this revision"}
				</b>
			</p>
			<p>
				Reviewed source: {question.question.source} · SHA-256 <code>{question.question.reviewedRevision}</code>
			</p>
			{Boolean(response.response.answers) && (
				<p>
					Recorded option IDs:{" "}
					{response.response.answers?.map((answer) => `${answer.prompt}: ${answer.selected.join(", ") || "text only"}`).join("; ")}. Labels and
					reasoning are recorded below.
				</p>
			)}
			{Boolean(response.response.supersedes) && (
				<p>
					Explicitly supersedes <a href={fileUrl(supersedesFile ?? "")}>{response.response.supersedes}</a>.
				</p>
			)}
			<LazyResponseMarkdown file={responseFile} source={response.body} />
			<p>
				<a href={fileUrl(responseFile)}>Response source</a> · <a href={fileUrl(questionFile)}>Registered reviewed context</a>
			</p>
			<details>
				<summary>Exact reviewed result source</summary>
				<pre>{question.context}</pre>
			</details>
		</article>
	);
}
