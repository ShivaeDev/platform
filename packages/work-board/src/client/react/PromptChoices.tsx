import type { Document } from "#browser/document/schema.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import { RadioGroup } from "#client/react/components/ui/radio-group.tsx";
import { PromptOption } from "./PromptOption.tsx";

export function PromptChoices({
	choose,
	document,
	labelledBy,
	prompt,
	selected,
}: {
	readonly choose: (id: string, checked: boolean) => void;
	readonly document: Document;
	readonly labelledBy: string;
	readonly prompt: Prompt;
	readonly selected: readonly string[];
}) {
	const className = `gap-2 ${document.metadata.options ? "question-choices" : ""}`;
	const options = prompt.options.map((option, choice) => (
		<PromptOption
			checked={selected.includes(option.id)}
			choice={choice}
			choose={choose}
			document={document}
			key={option.id}
			option={option}
			prompt={prompt}
		/>
	));
	if (prompt.mode !== "one") {
		return <div className={`grid ${className}`}>{options}</div>;
	}
	return (
		<RadioGroup
			aria-labelledby={labelledBy}
			className={className}
			name={`choice-${prompt.id}`}
			onValueChange={(value: string) => choose(value, true)}
			value={selected[0] ?? null}
		>
			{options}
		</RadioGroup>
	);
}
