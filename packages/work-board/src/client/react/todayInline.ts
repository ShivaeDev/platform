import type { DocumentRequest } from "#browser/document/schema.ts";
import { promptHeading } from "#browser/responses/cardContext.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import { reasonMarkdown } from "#browser/responses/reasonMarkdown.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";

export type Inline =
	| { readonly mode: "options"; readonly preview: QuestionPreview; readonly prompt: Prompt }
	| { readonly mode: "text"; readonly preview: QuestionPreview; readonly prompt: Prompt | undefined };

export function inlineReason(inline: Inline) {
	return { heading: inline.prompt && promptHeading(inline.prompt.source).title, reason: reasonMarkdown(inline.preview.reason).split("\n")[0] };
}

export function inlineAnswer(request: DocumentRequest | undefined): Inline | undefined {
	const preview = request?.preview;
	if (!(preview && request.prompts)) {
		return undefined;
	}
	const [prompt, ...others] = request.prompts;
	if (others.length > 0) {
		return undefined;
	}
	if (!prompt || prompt.mode === "text") {
		return { mode: "text", preview, prompt };
	}
	return prompt.mode === "one" ? { mode: "options", preview, prompt } : undefined;
}
