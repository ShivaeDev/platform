import type { Document, DocumentRequest } from "#browser/document/schema.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import { AnswerPrompts } from "./AnswerPrompts.tsx";
import { FormField } from "./FormField.tsx";
import { shellIds } from "./shellIds.ts";
import { useFormFocus } from "./useFormFocus.ts";
import { useResponseForm } from "./useResponseForm.ts";

interface AnswerProps {
	readonly document: Document;
	readonly preview: QuestionPreview;
	readonly request: DocumentRequest;
}
export function AnswerForm(props: AnswerProps) {
	return <AnswerSession key={JSON.stringify([props.preview.item, props.preview.request, Boolean(props.request.prompts?.length)])} {...props} />;
}
function AnswerSession({ document: data, request, preview }: AnswerProps) {
	function id(value: string) {
		return data.requests.filter((entry) => entry.open).length > 1 ? `${value}-${request.id}` : value;
	}
	const prompts = request.prompts ?? [];
	const state = useResponseForm(preview, prompts);
	const choices = Boolean(data.metadata.options);
	const focus = useFormFocus(state.draft.key);
	const form = state.form;
	const body = (
		<FormField
			form={form}
			label={prompts.length > 0 ? "Overall response / next action (optional)" : "Your response"}
			maxLength={32_768}
			name="body"
			required={prompts.length === 0}
			rows={4}
			showErrors={state.attempted}
		/>
	);
	const writableStatus = typeof window === "undefined" ? "JavaScript is required to record a response." : state.status;
	return (
		<form
			{...focus}
			data-item={preview.item}
			data-question={preview.id}
			data-request={preview.request}
			data-response-form
			data-revision={preview.reviewedRevision}
			data-writable={data.writable}
			id={id(shellIds.responseForm)}
			noValidate
			onChange={state.edit}
			onInput={state.edit}
			onSubmit={(event) => {
				event.preventDefault();
				state.attempt();
				if (!state.valid) {
					const target = event.currentTarget;
					requestAnimationFrame(() => target.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
				}
				if (data.writable && state.preview && state.valid && !state.created.saving) {
					state.created.save();
				}
			}}
		>
			<FormField autoComplete="nickname" form={form} label="Local author label" maxLength={200} name="author" required showErrors={state.attempted} />
			<AnswerPrompts
				answers={state.answers ?? []}
				document={data}
				form={form}
				onEdit={state.editAnswers}
				prompts={prompts}
				showErrors={state.attempted}
			/>
			{(prompts.length === 0 || !choices) && body}
			<details data-key="response-details">
				<summary>Response details</summary>
				<FormField form={form} label="Response kind" name="type">
					<option value="answer">Answer (including no)</option>
					<option value="clarify">Ask back / clarify</option>
					<option value="not_now">Not now</option>
				</FormField>
				{prompts.length > 0 && choices && body}
				<FormField form={form} label="Supersedes an earlier response (optional)" name="supersedes">
					<option value="">Adds feedback; does not supersede</option>
					{request.responses?.map((record) => (
						<option key={record.id} value={record.id}>
							{record.id} · {record.response.author} · {record.response.reviewedRevision.slice(0, 12)}
						</option>
					))}
				</FormField>
			</details>
			<pre hidden={!state.recovery} id={id(shellIds.responseDraftRecovery)}>
				{state.recovery}
			</pre>
			<p>
				Submit the whole packet together. Drafts stay in this browser for seven days after the last edit, with a 256 KiB limit per draft. Saved
				responses are Markdown files in responses/.
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
			<button disabled={!(data.writable && state.preview) || state.created.saving} id={id(shellIds.responseSubmit)} type="submit">
				Record response
			</button>
			<button disabled={typeof window === "undefined" || state.created.saving} id={id(shellIds.responseClear)} onClick={state.clear} type="button">
				Clear draft
			</button>
			<p data-outcome={state.outcome} id={id(shellIds.responseStatus)} role="status">
				{data.writable ? writableStatus : `${state.status} Read-only mode. Restart with --responses to explicitly enable local writes.`}
			</p>
		</form>
	);
}
