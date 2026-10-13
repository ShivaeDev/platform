import type { Document } from "#browser/document/schema.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import { ResponseMarkdown } from "./ResponseMarkdown.tsx";
export function PromptOption({
	document,
	prompt,
	option,
	choice,
	index,
	checked,
	choose,
}: {
	readonly document: Document;
	readonly prompt: Prompt;
	readonly option: Prompt["options"][number];
	readonly choice: number;
	readonly index: number;
	readonly checked: boolean;
	readonly choose: (id: string, checked: boolean) => void;
}) {
	const source = document.metadata.options?.[choice];
	const id = `question-${index}-${choice}`;
	const control = (
		<input
			checked={checked}
			data-option-source={option.source}
			hidden={Boolean(source)}
			id={id}
			name={`choice-${prompt.id}`}
			onChange={(event) => choose(option.id, event.currentTarget.checked)}
			onInput={(event) => choose(option.id, event.currentTarget.checked)}
			type={prompt.mode === "one" ? "radio" : "checkbox"}
			value={option.id}
		/>
	);
	return source ? (
		<div>
			{control}
			<button aria-pressed={checked} className="question-choice" data-choice={option.id} onClick={() => choose(option.id, true)} type="button">
				<strong>
					{source.label}
					{source.label === document.metadata.recommended && " · Recommended"}
				</strong>
				<small>{source.description}</small>
			</button>
		</div>
	) : (
		<div className="question-option">
			{control}
			<div>
				<label htmlFor={id}>Option {option.id}</label>
				<ResponseMarkdown file={document.file} source={option.source} />
			</div>
		</div>
	);
}
