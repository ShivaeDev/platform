import { useId } from "react";
import type { Document } from "#browser/document/schema.ts";
import { optionText } from "#browser/responses/cardContext.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import { Badge } from "#client/react/components/ui/Badge.tsx";
import { cn } from "#client/react/lib/cn.ts";

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
	return (
		<div>
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
			<button
				aria-pressed={checked}
				className={cn(
					"question-choice flex w-full items-start gap-3 rounded-lg border bg-background px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					checked && "border-primary bg-accent",
				)}
				data-choice={option.id}
				onClick={() => choose(option.id, prompt.mode !== "many" || !checked)}
				type="button"
			>
				<span
					aria-hidden="true"
					className={cn(
						"mt-0.5 grid size-4 shrink-0 place-items-center border border-muted-foreground",
						prompt.mode === "many" ? "rounded-sm" : "rounded-full",
						checked && "border-primary",
					)}
				>
					{checked ? <span className={cn("size-2 bg-primary", prompt.mode === "many" ? "rounded-[1px]" : "rounded-full")} /> : null}
				</span>
				<span className="grid gap-1">
					<strong className="flex flex-wrap items-center gap-2 font-medium text-sm">
						{label}
						{label === document.metadata.recommended && <Badge variant="outline">Recommended</Badge>}
					</strong>
					{Boolean(description) && <small className="text-muted-foreground text-sm">{description}</small>}
				</span>
			</button>
		</div>
	);
}
