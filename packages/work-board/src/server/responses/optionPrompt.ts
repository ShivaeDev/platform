import type { Prompt } from "#browser/responses/Prompt.ts";
import type { Metadata } from "#metadata/schema.ts";

export function optionPrompt(fields: Metadata): Prompt | undefined {
	if (fields.kind !== "question" || fields.question || fields.options === undefined) {
		return undefined;
	}
	if (new Set(fields.options.map((option) => option.label)).size !== fields.options.length) {
		throw new Error("Question option labels must be unique.");
	}
	if (fields.recommended && !fields.options.some((option) => option.label === fields.recommended)) {
		throw new Error("The recommended option must name an option label.");
	}
	return {
		id: "answer",
		mode: "one",
		options: fields.options.map((option, index) => ({ id: `option-${index + 1}`, source: `${option.label}\n\n${option.description}` })),
		source: "Your answer",
	};
}
