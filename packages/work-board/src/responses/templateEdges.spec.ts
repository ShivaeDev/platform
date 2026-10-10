import { expect, it } from "vitest";
import { questionTemplate } from "#responses/template.ts";
import { packetOption, TEXT_QUESTION } from "#test/coverageEdges.ts";
import { questionnaireSource } from "#test/questionnaire.ts";

it("rejects a packet explicitly scoped to an attention request absent from the source", () => {
	expect(() => questionTemplate(questionnaireSource.replace('id="display"', 'id="display" request="missing"'), "direction")).toThrow(
		"A question's request= must name an attention request in this document.",
	);
});

it("rejects empty option descriptions and nested response controls inside options", () => {
	for (const body of ["", '::question[Nested]{id="nested"}']) {
		expect(() => questionTemplate(packetOption(body), "direction")).toThrow("Options need Markdown descriptions and cannot nest response controls.");
	}
});

it("preserves external packet links when relocating reviewed descriptions", () => {
	const source = TEXT_QUESTION.replace(
		"What should happen next?",
		"See [web](https://example.com/check?q=1#result) and [network](//example.com/check).",
	);
	const template = questionTemplate(source, "direction", "nested/item.md");
	expect(template.prompts[0]?.source).toContain("<https://example.com/check?q=1#result>");
	expect(template.prompts[0]?.source).toContain("<//example.com/check>");
});
