import { cn } from "cn";
import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";
import type { Document, DocumentRequest } from "#browser/document/schema.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import { Button } from "#client/react/components/ui/button.tsx";
import { AnswerMore } from "./AnswerMore.tsx";
import { AnswerPrompts } from "./AnswerPrompts.tsx";
import { answerTextClass } from "./answerTextClass.ts";
import { FormField } from "./FormField.tsx";
import { shellIds } from "./shellIds.ts";
import { useAnswerOffline } from "./useAnswerOffline.ts";
import { useFormFocus } from "./useFormFocus.ts";
import { useResponseForm } from "./useResponseForm.ts";

interface AnswerProps {
	readonly document: Document;
	readonly onDraft?: ((text: string) => void) | undefined;
	readonly preview: QuestionPreview;
	readonly request: DocumentRequest;
}
export function AnswerForm(props: AnswerProps) {
	return (
		<AnswerSession
			key={JSON.stringify([props.preview.item, props.preview.request, Boolean(props.request.prompts?.length), props.request.answered?.response])}
			{...props}
		/>
	);
}
function AnswerSession({ document: data, onDraft, request, preview }: AnswerProps) {
	function id(value: string) {
		return data.requests.filter((entry) => entry.open).length > 1 ? `${value}-${request.id}` : value;
	}
	const prompts = request.prompts ?? [];
	const state = useResponseForm(preview, prompts, request.options, request.answered?.response);
	const focus = useFormFocus(state.draft.key);
	const form = state.form;
	const offline = useAnswerOffline();
	useEffect(() => onDraft?.(state.text), [onDraft, state.text]);
	const body = (
		<FormField
			className={answerTextClass(prompts.length === 0)}
			form={form}
			label={prompts.length > 0 ? "Anything else to add (optional)" : "Your answer"}
			maxLength={32_768}
			name="body"
			required={prompts.length === 0}
			rows={4}
			showErrors={state.attempted}
		/>
	);
	return (
		<form
			{...focus}
			data-item={preview.item}
			data-question={preview.id}
			data-request={preview.request}
			data-response-form
			data-revision={preview.reviewedRevision}
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
				if (valid && !state.created.saving) {
					state.created.save();
				}
			}}
		>
			<fieldset className="m-0 min-w-0 space-y-4 border-0 p-0" disabled={Boolean(offline)}>
				<AnswerPrompts
					answers={state.answers ?? []}
					document={data}
					form={form}
					onEdit={state.editAnswers}
					prompts={prompts}
					showErrors={state.attempted}
				/>
				{prompts.length === 0 && body}
				<div className="flex flex-wrap items-center gap-3">
					<Button disabled={state.created.saving} id={id(shellIds.responseSubmit)} type="submit">
						Record answer
					</Button>
					{offline ? (
						<p className="m-0 text-muted-foreground text-sm" role="status">
							{offline}
						</p>
					) : null}
				</div>
				<p
					className={cn(
						"flex items-start gap-2 text-sm empty:hidden",
						state.outcome === "saved" && "rounded-md border border-done/40 bg-done/10 px-3 py-2",
						(state.outcome === "rejected" || state.outcome === "uncertain") && "rounded-md border border-destructive/40 px-3 py-2 text-destructive",
					)}
					data-outcome={state.outcome}
					id={id(shellIds.responseStatus)}
					role="status"
				>
					{state.outcome === "saved" && <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-done" />}
					{state.status}
				</p>
				<AnswerMore body={prompts.length > 0 ? body : undefined} id={id} request={request} state={state} />
			</fieldset>
		</form>
	);
}
