import { useId } from "react";
import type { Document } from "#browser/document/schema.ts";
import { optionText } from "#browser/responses/cardContext.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { Checkbox } from "#client/react/components/ui/checkbox.tsx";
import { Label } from "#client/react/components/ui/label.tsx";
import { RadioGroupItem } from "#client/react/components/ui/radio-group.tsx";

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
		<div className="question-choice relative flex items-start gap-3 rounded-lg border bg-background px-4 py-3 transition-colors hover:bg-accent has-data-checked:border-primary has-data-checked:bg-accent">
			{prompt.mode === "many" ? (
				<Checkbox {...control} checked={checked} name={`choice-${prompt.id}`} onCheckedChange={(next) => choose(option.id, next)} />
			) : (
				<RadioGroupItem {...control} />
			)}
			<Label className="grid flex-1 cursor-pointer items-start gap-1 font-normal after:absolute after:inset-0" htmlFor={id}>
				<strong className="flex flex-wrap items-center gap-2 font-medium text-sm" id={`${id}-label`}>
					{label}
					{label === document.metadata.recommended && <Badge variant="outline">Recommended</Badge>}
				</strong>
				{Boolean(description) && (
					<small className="text-muted-foreground text-sm leading-normal" id={`${id}-description`}>
						{description}
					</small>
				)}
			</Label>
		</div>
	);
}
