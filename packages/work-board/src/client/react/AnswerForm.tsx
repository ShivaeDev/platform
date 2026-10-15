import type { Document, DocumentRequest } from "#browser/document/schema.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import { AnswerMore } from "./AnswerMore.tsx";
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
				const valid = state.attempt();
				if (!valid) {
					const target = event.currentTarget;
					requestAnimationFrame(() => {
						const invalid = target.querySelector<HTMLElement>('[aria-invalid="true"]');
						const more = invalid?.closest("details");
						if (more) {
							more.open = true;
						}
						invalid?.focus();
					});
				}
				if (data.writable && valid && !state.created.saving) {
					state.created.save();
				}
			}}
		>
			<AnswerPrompts
				answers={state.answers ?? []}
				document={data}
				form={form}
				onEdit={state.editAnswers}
				prompts={prompts}
				showErrors={state.attempted}
			/>
			{prompts.length === 0 && body}
			<button disabled={!data.writable || state.created.saving} id={id(shellIds.responseSubmit)} type="submit">
				Record
			</button>
			<AnswerMore body={prompts.length > 0 ? body : undefined} id={id} request={request} state={state} />
			<p data-outcome={state.outcome} id={id(shellIds.responseStatus)} role="status">
				{data.writable ? writableStatus : `${state.status} Read-only. Restart with --responses to enable answers.`.trim()}
			</p>
		</form>
	);
}
