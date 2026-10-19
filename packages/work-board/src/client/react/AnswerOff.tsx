import type { Document, DocumentRequest } from "#browser/document/schema.ts";
import { optionText, promptHeading } from "#browser/responses/cardContext.ts";
import { Badge } from "#client/react/components/ui/badge.tsx";
import { AnswerMarkdown } from "./AnswerMarkdown.tsx";

type Prompt = NonNullable<DocumentRequest["prompts"]>[number];

function OptionItem({ choice, document, option }: { readonly choice: number; readonly document: Document; readonly option: Prompt["options"][number] }) {
	const authored = document.metadata.options?.[choice];
	const source = optionText(option.id, option.source);
	const label = authored?.label ?? source.label;
	const description = authored?.description ?? source.description;
	return (
		<li>
			<span className="font-medium">{label}</span>
			{label === document.metadata.recommended && (
				<Badge className="ml-2" variant="outline">
					Recommended
				</Badge>
			)}
			{Boolean(description) && <span className="text-muted-foreground"> — {description}</span>}
		</li>
	);
}

function PromptOff({ document, index, prompt }: { readonly document: Document; readonly index: number; readonly prompt: Prompt }) {
	const heading = promptHeading(prompt.source);
	const authored = document.metadata.options !== undefined;
	return (
		<div className="space-y-2" data-prompt={prompt.id}>
			<h3 className="font-semibold text-base">{authored ? "Options" : (heading.title ?? `Question ${index + 1}`)}</h3>
			{!authored && heading.rest ? <AnswerMarkdown className="text-sm" file={document.file} source={heading.rest} /> : null}
			{prompt.options.length > 0 && (
				<ul className="list-disc space-y-1 pl-5 text-sm">
					{prompt.options.map((option, choice) => (
						<OptionItem choice={choice} document={document} key={option.id} option={option} />
					))}
				</ul>
			)}
		</div>
	);
}

export function AnswerOff({ document, request }: { readonly document: Document; readonly request: DocumentRequest }) {
	return (
		<>
			{(request.prompts ?? []).map((prompt, index) => (
				<PromptOff document={document} index={index} key={prompt.id} prompt={prompt} />
			))}
			<p className="rounded-md bg-muted px-3 py-2 text-muted-foreground text-sm" role="status">
				Answering is turned off on this Board.
			</p>
		</>
	);
}
