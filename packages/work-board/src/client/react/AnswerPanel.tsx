import type { Document } from "#browser/document/schema.ts";
import { fileUrl } from "#files/url.ts";
import { AnswerForm } from "./AnswerForm.tsx";
import { ResponseHistory } from "./ResponseHistory.tsx";
export function AnswerPanel({ document: data }: { readonly document: Document }) {
	const request = data.requests.find((entry) => entry.id === "answer");
	const preview = request?.preview;
	const unavailable = request?.unavailable ?? request?.promptUnavailable;
	const open = !["closed", "done", "completed", "cancelled", "canceled", "resolved", "released"].includes(
		data.metadata.status?.trim().toLowerCase() ?? "",
	);
	let title = "Answer unavailable";
	if (!open) {
		title = "Question closed";
	} else if (preview && !unavailable) {
		title = "Answer this question";
	}
	return (
		<section className="response-panel">
			<h2>{title}</h2>
			{!open && <p role="status">This question is closed. Recorded answers remain below.</p>}
			{Boolean(unavailable) && <p role="status">{unavailable}</p>}
			{open && preview !== undefined && request !== undefined && !unavailable && (
				<>
					<p>{preview.reason}</p>
					<p>
						<a href={fileUrl(preview.source)}>Source: {preview.source}</a> · Reviewed SHA-256: <code>{preview.reviewedRevision}</code>
					</p>
					<p>An answer removes this question from the Inbox for this source revision.</p>
					<details>
						<summary>Exact source being reviewed</summary>
						<pre>{preview.context}</pre>
					</details>
					<AnswerForm document={data} preview={preview} request={request} />
				</>
			)}
			{!request?.unavailable && <ResponseHistory request={request} />}
		</section>
	);
}
