import type { Document, DocumentRequest } from "#browser/document/schema.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import { AnswerFocus } from "./AnswerFocus.tsx";
import { AnswerPrompts } from "./AnswerPrompts.tsx";
import { shellIds } from "./shellIds.ts";
export function AnswerForm({
	document: data,
	request,
	preview,
}: {
	readonly document: Document;
	readonly request: DocumentRequest;
	readonly preview: QuestionPreview;
}) {
	const prompts = request.prompts ?? [];
	const records = request.responses ?? [];
	const body = (
		<label>
			{prompts.length > 0 ? "Overall response / next action (optional)" : "Your response"}
			<textarea maxLength={32_768} name="body" required={prompts.length === 0} rows={4} />
		</label>
	);
	return (
		<AnswerFocus context={preview.id}>
			<form
				data-item={preview.item}
				data-question={preview.id}
				data-request={preview.request}
				data-revision={preview.reviewedRevision}
				data-writable={data.writable}
				id={shellIds.responseForm}
				noValidate
			>
				<label>
					Local author label <input autoComplete="nickname" maxLength={200} name="author" required />
				</label>
				<AnswerPrompts document={data} prompts={prompts} />
				{prompts.length === 0 && body}
				<AnswerDetails body={prompts.length > 0 ? body : null} records={records} />
				<pre hidden id={shellIds.responseDraftRecovery} />
				<p>
					Submit the whole packet together. Drafts stay in this browser for seven days after the last edit, with a 256 KiB limit per draft. Saved
					responses are Markdown files in responses/.
				</p>
				<button disabled id={shellIds.responsePreview} type="button">
					Preview Markdown
				</button>
				<pre hidden id={shellIds.responsePreviewContent} />
				<button disabled id={shellIds.responseSubmit} type="submit">
					Record response
				</button>
				<button disabled id={shellIds.responseClear} type="button">
					Clear draft
				</button>
				<p id={shellIds.responseStatus} role="status">
					{data.writable
						? "JavaScript is required to record a response."
						: "Read-only mode. Restart with --responses to explicitly enable local writes."}
				</p>
			</form>
		</AnswerFocus>
	);
}

function AnswerDetails({
	body,
	records,
}: {
	readonly body: import("react").ReactNode;
	readonly records: readonly import("#browser/responses/schema.ts").RecordedResponse[];
}) {
	const options = records.map((record) => (
		<option key={record.id} value={record.id}>
			{record.id} · {record.response.author} · {record.response.reviewedRevision.slice(0, 12)}
		</option>
	));
	return (
		<details data-key="response-details">
			<summary>Response details</summary>
			<label>
				Response kind{" "}
				<select name="type">
					<option value="answer">Answer (including no)</option>
					<option value="clarify">Ask back / clarify</option>
					<option value="not_now">Not now</option>
				</select>
			</label>
			{body}
			<label>
				Supersedes an earlier response (optional)
				<select name="supersedes">
					<option value="">Adds feedback; does not supersede</option>
					{options}
				</select>
			</label>
		</details>
	);
}
