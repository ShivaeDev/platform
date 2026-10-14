import type { ReactNode } from "react";
import type { DocumentRequest } from "#browser/document/schema.ts";
import { FormField } from "./FormField.tsx";
import { shellIds } from "./shellIds.ts";
import type { useResponseForm } from "./useResponseForm.ts";

export function AnswerMore({
	body,
	id,
	request,
	state,
}: {
	readonly body?: ReactNode;
	readonly id: (value: string) => string;
	readonly request: DocumentRequest;
	readonly state: ReturnType<typeof useResponseForm>;
}) {
	return (
		<details data-key="response-details">
			<summary>More</summary>
			<FormField
				autoComplete="nickname"
				form={state.form}
				label="Local author label"
				maxLength={200}
				name="author"
				required
				showErrors={state.attempted}
			/>
			<FormField form={state.form} label="Response kind" name="type">
				<option value="answer">Answer (including no)</option>
				<option value="clarify">Ask back / clarify</option>
				<option value="not_now">Not now</option>
			</FormField>
			{body}
			<FormField form={state.form} label="Supersedes an earlier response (optional)" name="supersedes">
				<option value="">Adds feedback; does not supersede</option>
				{request.responses?.map((record) => (
					<option key={record.id} value={record.id}>
						{record.id} · {record.response.author} · {record.response.reviewedRevision.slice(0, 12)}
					</option>
				))}
			</FormField>
			<pre hidden={!state.recovery} id={id(shellIds.responseDraftRecovery)}>
				{state.recovery}
			</pre>
			<p>
				Drafts stay in this browser for seven days after the last edit, with a 256 KiB limit per draft. Saved responses are Markdown files in
				responses/.
			</p>
			<button
				disabled={typeof window === "undefined" || state.created.saving}
				id={id(shellIds.responsePreview)}
				onClick={state.showPreview}
				type="button"
			>
				Preview Markdown
			</button>
			<pre hidden={!state.preview} id={id(shellIds.responsePreviewContent)}>
				{state.preview}
			</pre>
			<button disabled={typeof window === "undefined" || state.created.saving} id={id(shellIds.responseClear)} onClick={state.clear} type="button">
				Clear draft
			</button>
		</details>
	);
}
