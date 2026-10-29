import { useId } from "react";
import type { Document } from "#browser/document/schema.ts";
import { optionText } from "#browser/responses/cardContext.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { Checkbox } from "#client/react/components/ui/checkbox.tsx";
import { Label } from "#client/react/components/ui/label.tsx";
import { RadioGroupItem } from "#client/react/components/ui/radio-group.tsx";
import { AnswerMarkdown } from "./AnswerMarkdown.tsx";

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
	const authored = optionText(option.id, option.source);
	const label = source?.label ?? authored.label;
	const description = source?.description ?? authored.description;
	const control = {
		"aria-describedby": description ? `${id}-description` : undefined,
		"aria-labelledby": `${id}-label`,
		className: "mt-0.5",
		"data-choice": option.id,
		id,
		value: option.id,
	};
	return (
		<div className="question-choice bg-background hover:bg-accent has-data-checked:border-primary has-data-checked:bg-accent relative flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors">
			{prompt.mode === "many" ? (
				<Checkbox {...control} checked={checked} name={`choice-${prompt.id}`} onCheckedChange={(next) => choose(option.id, next)} />
			) : (
				<RadioGroupItem {...control} />
			)}
			<div className="grid flex-1 items-start gap-1">
				<Label className="cursor-pointer font-normal after:absolute after:inset-0" htmlFor={id}>
					<strong className="flex flex-wrap items-center gap-2 text-sm font-medium" id={`${id}-label`}>
						{label}
						{label === document.metadata.recommended && <Badge variant="outline">Recommended</Badge>}
					</strong>
				</Label>
				{Boolean(description) && (
					<div className="text-muted-foreground text-sm leading-normal [&_a]:relative [&_a]:z-10" id={`${id}-description`}>
						<AnswerMarkdown file={document.file} source={description} />
					</div>
				)}
			</div>
		</div>
	);
}
