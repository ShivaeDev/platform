import type { RespondProjection } from "#browser/views/remaining.ts";
import { fileUrl } from "#files/url.ts";
import { AnswerForm } from "./AnswerForm.tsx";
import { ResponseHistory } from "./ResponseHistory.tsx";
import { ResponseMarkdown } from "./ResponseMarkdown.tsx";
export function RespondPage({ data: { document: data, request } }: { readonly data: RespondProjection }) {
	const preview = request.preview;
	if (!preview) {
		return <p role="status">Response unavailable</p>;
	}
	const standalone = data.metadata.kind === "question";
	return (
		<section className="response-panel">
			<h1>{standalone ? "Answer this question" : `Respond to ${preview.item} / ${preview.request}`}</h1>
			<p>{preview.reason}</p>
			<p>
				<a href={fileUrl(preview.source)}>Source: {preview.source}</a> · Reviewed SHA-256: <code>{preview.reviewedRevision}</code>
			</p>
			<p>
				{standalone
					? "An answer removes this question from the Inbox for this source revision."
					: "Saved replies are authored feedback. They do not close the request or establish acceptance."}
			</p>
			{!standalone && (
				<section className="response-context">
					<ResponseMarkdown file={data.file} source={data.source} />
				</section>
			)}
			<details>
				<summary>Exact source being reviewed</summary>
				<pre>{preview.context}</pre>
			</details>
			{request.unavailable || request.promptUnavailable ? (
				<p role="status">{request.unavailable ?? request.promptUnavailable}</p>
			) : (
				<AnswerForm document={data} preview={preview} request={request} />
			)}
			{!request.unavailable && <ResponseHistory request={request} />}
		</section>
	);
}
