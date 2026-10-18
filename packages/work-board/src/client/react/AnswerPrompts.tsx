import { useAtomValue } from "@effect/atom-react";
import { useId, useLayoutEffect, useRef } from "react";
import type { Document } from "#browser/document/schema.ts";
import { promptHeading } from "#browser/responses/cardContext.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import type { PromptAnswer } from "#browser/responses/schema.ts";
import { Button } from "#client/react/components/ui/button.tsx";
import { Label } from "#client/react/components/ui/label.tsx";
import { Textarea } from "#client/react/components/ui/textarea.tsx";
import { AnswerMarkdown } from "./AnswerMarkdown.tsx";
import { PromptChoices } from "./PromptChoices.tsx";
import type { useResponseForm } from "./useResponseForm.ts";

type Model = ReturnType<typeof useResponseForm>["form"];
interface PromptProps {
	readonly answers: readonly PromptAnswer[];
	readonly document: Document;
	readonly form: Model;
	readonly onEdit: (index: number, answer: PromptAnswer) => void;
	readonly prompts: readonly Prompt[];
	readonly showErrors: boolean;
}
export function AnswerPrompts(props: PromptProps) {
	return props.prompts.map((prompt, index) => <PromptField {...props} index={index} key={prompt.id} prompt={prompt} />);
}
function PromptField({
	document,
	prompt,
	index,
	answers,
	form,
	onEdit,
	showErrors,
}: PromptProps & { readonly prompt: Prompt; readonly index: number }) {
	const fieldId = useId();
	const answer = answers[index] ?? { prompt: prompt.id, selected: [], text: "" };
	const validation = useAtomValue(form.errorAt(["answers", index, "text"]));
	const error = showErrors ? validation : undefined;
	const ref = useRef<HTMLTextAreaElement>(null);
	useLayoutEffect(() => ref.current?.setCustomValidity(error ?? ""), [error]);
	const choices = document.metadata.options;

	const guidance = promptGuidance(prompt.mode, choices !== undefined);
	const heading = promptHeading(prompt.source);
	const title = heading.title ?? `Question ${index + 1}`;
	function change(next: PromptAnswer) {
		onEdit(index, next);
	}

	function choose(id: string, checked: boolean) {
		let selected: readonly string[] = [];
		if (prompt.mode === "one") {
			selected = checked ? [id] : [];
		} else {
			selected = checked ? [...new Set([...answer.selected, id])] : answer.selected.filter((entry) => entry !== id);
		}
		change({ ...answer, selected });
	}
	let message = error;
	if (error && answer.selected.length === 0 && !answer.text.trim()) {
		message = `Unanswered: “${title}”. Choose an option or answer in your own words.`;
	}
	return (
		<fieldset className="m-0 min-w-0 space-y-3 border-0 p-0" data-mode={prompt.mode} data-prompt={prompt.id} data-source={prompt.source}>
			<legend className="mb-1 p-0 font-semibold text-base" id={`${fieldId}-legend`}>
				{choices === undefined ? title : "Your answer"}
			</legend>
			{choices === undefined && heading.rest ? <AnswerMarkdown className="text-sm" file={document.file} source={heading.rest} /> : null}
			<p className="text-muted-foreground text-sm">{guidance}</p>
			<PromptChoices choose={choose} document={document} labelledBy={`${fieldId}-legend`} prompt={prompt} selected={answer.selected} />
			{prompt.mode !== "text" && (
				<Button
					className="h-auto px-0 text-muted-foreground text-xs"
					data-clear-choices
					disabled={answer.selected.length === 0}
					onClick={() => change({ ...answer, selected: [] })}
					size="sm"
					type="button"
					variant="link"
				>
					Clear selections
				</Button>
			)}
			<Label className="font-normal leading-normal" htmlFor={fieldId}>
				{prompt.mode === "text" ? "Your answer" : "Add a note or answer in your own words (optional)"}
			</Label>
			<Textarea
				aria-describedby={`${fieldId}-error`}
				aria-invalid={Boolean(error)}
				data-answer-text
				id={fieldId}
				maxLength={8192}
				onInput={(event) => change({ ...answer, text: event.currentTarget.value })}
				ref={ref}
				rows={choices || prompt.mode === "text" ? 4 : 2}
				value={answer.text}
			/>
			<span className="response-field-error block text-destructive text-xs" hidden={!error} id={`${fieldId}-error`}>
				{message}
			</span>
		</fieldset>
	);
}

function promptGuidance(mode: Prompt["mode"], authored: boolean) {
	if (authored) {
		return "Choose an option or write another answer. Nothing is selected for you.";
	}
	if (mode === "text") {
		return "Answer in your own words.";
	}
	return `${mode === "one" ? "Choose one option" : "Choose any combination"}, or answer in your own words. Nothing is selected for you.`;
}
