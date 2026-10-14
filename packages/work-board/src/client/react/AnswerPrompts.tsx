import { useAtomValue } from "@effect/atom-react";
import { useId, useLayoutEffect, useRef } from "react";
import type { Document } from "#browser/document/schema.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import type { PromptAnswer } from "#browser/responses/schema.ts";
import { PromptOption } from "./PromptOption.tsx";
import { ResponseMarkdown } from "./ResponseMarkdown.tsx";
import type { useResponseForm } from "./useResponseForm.ts";

type Model = ReturnType<typeof useResponseForm>["form"];
interface PromptProps {
	readonly answers: readonly PromptAnswer[];
	readonly document: Document;
	readonly form: Model;
	readonly onEdit: (index: number, answer: PromptAnswer) => void;
	readonly prompts: readonly Prompt[];
}
export function AnswerPrompts(props: PromptProps) {
	return props.prompts.map((prompt, index) => <PromptField {...props} index={index} key={prompt.id} prompt={prompt} />);
}
function PromptField({ document, prompt, index, answers, form, onEdit }: PromptProps & { readonly prompt: Prompt; readonly index: number }) {
	const errorId = useId();
	const answer = answers[index] ?? { prompt: prompt.id, selected: [], text: "" };
	const error = useAtomValue(form.errorAt(["answers", index, "text"]));
	const ref = useRef<HTMLTextAreaElement>(null);
	useLayoutEffect(() => ref.current?.setCustomValidity(error ?? ""), [error]);
	const choices = document.metadata.options;

	let guidance = "Answer in your own words.";
	if (choices) {
		guidance = "Choose an option or write another answer.";
	} else if (prompt.mode !== "text") {
		guidance = `${prompt.mode === "one" ? "Choose one option" : "Choose any combination"}, or answer in your own words.`;
	}
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
		message = `Unanswered: Question ${index + 1} · ${prompt.id}. Choose an option or answer in your own words.`;
	}
	return (
		<fieldset data-mode={prompt.mode} data-prompt={prompt.id} data-source={prompt.source}>
			<legend>{choices ? "Your answer" : `Question ${index + 1} · ${prompt.id}`}</legend>
			{choices === undefined && <ResponseMarkdown file={document.file} source={prompt.source} />}
			<p>{guidance} Nothing is selected for you.</p>
			<div className={choices ? "question-choices" : undefined}>
				{prompt.options.map((option, choice) => (
					<PromptOption
						checked={answer.selected.includes(option.id)}
						choice={choice}
						choose={choose}
						document={document}
						key={option.id}
						option={option}
						prompt={prompt}
					/>
				))}
			</div>
			{prompt.mode !== "text" && (
				<button data-clear-choices onClick={() => change({ ...answer, selected: [] })} type="button">
					Clear selections
				</button>
			)}
			<label>
				{choices ? "Another answer / additional text" : "Additional text / another answer"}
				<textarea
					aria-describedby={`${errorId}-error`}
					aria-invalid={Boolean(error)}
					data-answer-text
					maxLength={8192}
					onInput={(event) => change({ ...answer, text: event.currentTarget.value })}
					ref={ref}
					rows={choices ? 4 : 3}
					value={answer.text}
				/>
				<span className="response-field-error" hidden={!error} id={`${errorId}-error`}>
					{message}
				</span>
			</label>
		</fieldset>
	);
}
