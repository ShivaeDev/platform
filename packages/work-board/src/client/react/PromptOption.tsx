import { useId } from "react";
import type { Document } from "#browser/document/schema.ts";
import { optionLabel } from "#browser/responses/cardContext.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import { ResponseMarkdown } from "./ResponseMarkdown.tsx";
export function PromptOption({
	document,
	prompt,
	option,
	choice,
	checked,
	choose,
}: {
	readonly document: Document;
	readonly prompt: Prompt;
	readonly option: Prompt["options"][number];
	readonly choice: number;
	readonly checked: boolean;
	readonly choose: (id: string, checked: boolean) => void;
}) {
	const source = document.metadata.options?.[choice];
	const id = useId();
	const control = (
		<input
			checked={checked}
			data-option-source={option.source}
			hidden
			id={id}
			name={`choice-${prompt.id}`}
			onChange={(event) => choose(option.id, event.currentTarget.checked)}
			onInput={(event) => choose(option.id, event.currentTarget.checked)}
			type={prompt.mode === "one" ? "radio" : "checkbox"}
			value={option.id}
		/>
	);
	const label = source?.label ?? optionLabel(option.id, option.source);
	return (
		<div>
			{control}
			<button
				aria-pressed={checked}
				className="question-choice"
				data-choice={option.id}
				onClick={() => choose(option.id, prompt.mode !== "many" || !checked)}
				type="button"
			>
				<strong>
					{label}
					{label === document.metadata.recommended && " · Recommended"}
				</strong>
				{source !== undefined && <small>{source.description}</small>}
			</button>
			{source === undefined && <ResponseMarkdown file={document.file} source={option.source.replace(/^#{1,6}\s+.+$/mu, "")} />}
		</div>
	);
}
