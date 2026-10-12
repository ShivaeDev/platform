import type { Document } from "#browser/document/schema.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import { ResponseMarkdown } from "./ResponseMarkdown.tsx";
export function AnswerPrompts({ document, prompts }: { readonly document: Document; readonly prompts: readonly Prompt[] }) {
	return prompts.map((prompt, index) => <PromptField document={document} index={index} key={prompt.id} prompt={prompt} />);
}
function PromptField({ document, prompt, index }: { readonly document: Document; readonly prompt: Prompt; readonly index: number }) {
	const choices = document.metadata.options;
	let guidance = "Answer in your own words.";
	if (choices) {
		guidance = "Choose an option or write another answer.";
	} else if (prompt.mode !== "text") {
		guidance = `${prompt.mode === "one" ? "Choose one option" : "Choose any combination"}, or answer in your own words.`;
	}
	const options = prompt.options.map((option, choice) => (
		<PromptOption choice={choice} document={document} index={index} key={option.id} option={option} prompt={prompt} />
	));
	return (
		<fieldset data-mode={prompt.mode} data-prompt={prompt.id} data-source={prompt.source}>
			<legend>{choices ? "Your answer" : `Question ${index + 1} · ${prompt.id}`}</legend>
			{choices === undefined && <ResponseMarkdown file={document.file} source={prompt.source} />}
			<p>{guidance} Nothing is selected for you.</p>
			<div className={choices ? "question-choices" : undefined}>{options}</div>
			{prompt.mode !== "text" && (
				<button data-clear-choices type="button">
					Clear selections
				</button>
			)}
			<label>
				{choices ? "Another answer / additional text" : "Additional text / another answer"}
				<textarea data-answer-text maxLength={8192} rows={choices ? 4 : 3} />
			</label>
		</fieldset>
	);
}
function PromptOption({
	document,
	prompt,
	option,
	choice,
	index,
}: {
	readonly document: Document;
	readonly prompt: Prompt;
	readonly option: Prompt["options"][number];
	readonly choice: number;
	readonly index: number;
}) {
	const source = document.metadata.options?.[choice];
	if (source) {
		return (
			<div>
				<input data-option-source={option.source} hidden name={`choice-${prompt.id}`} type="radio" value={option.id} />
				<button aria-pressed="false" className="question-choice" data-choice={option.id} type="button">
					<strong>
						{source.label}
						{source.label === document.metadata.recommended && " · Recommended"}
					</strong>
					<small>{source.description}</small>
				</button>
			</div>
		);
	}
	const id = `question-${index}-${choice}`;
	return (
		<div className="question-option">
			<input
				data-option-source={option.source}
				id={id}
				name={`choice-${prompt.id}`}
				type={prompt.mode === "one" ? "radio" : "checkbox"}
				value={option.id}
			/>
			<div>
				<label htmlFor={id}>Option {option.id}</label>
				<ResponseMarkdown file={document.file} source={option.source} />
			</div>
		</div>
	);
}
