import { CheckCircle2 } from "lucide-react";
import type { Document, DocumentRequest } from "#browser/document/schema.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import { Button } from "#client/react/components/ui/Button.tsx";
import { cn } from "#client/react/lib/cn.ts";
import { AnswerMore } from "./AnswerMore.tsx";
import { AnswerPrompts } from "./AnswerPrompts.tsx";
import { FormField } from "./FormField.tsx";
import { shellIds } from "./shellIds.ts";
import { useFormFocus } from "./useFormFocus.ts";
import { useResponseForm } from "./useResponseForm.ts";

const READ_ONLY = "This Board is read-only. Start it with --responses to record answers.";

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
			className="space-y-4"
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
			<div className="flex flex-wrap items-center gap-3">
				<Button disabled={!data.writable || state.created.saving} id={id(shellIds.responseSubmit)} type="submit">
					Record answer
				</Button>
			</div>
			<p
				className={cn(
					"flex items-start gap-2 text-sm empty:hidden",
					!data.writable && "text-muted-foreground",
					state.outcome === "saved" && "rounded-md border border-done/40 bg-done/10 px-3 py-2",
					(state.outcome === "rejected" || state.outcome === "uncertain") && "rounded-md border border-destructive/40 px-3 py-2 text-destructive",
				)}
				data-outcome={state.outcome}
				id={id(shellIds.responseStatus)}
				role="status"
			>
				{state.outcome === "saved" && <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-done" />}
				{data.writable ? writableStatus : `${state.status} ${READ_ONLY}`.trim()}
			</p>
			<AnswerMore body={prompts.length > 0 ? body : undefined} id={id} request={request} state={state} />
		</form>
	);
}
