import { expect, it } from "vitest";
import { metadataParse } from "#server/metadata/parse.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";
import { questionTemplate } from "./template.ts";
import { validatedInput } from "./validatedInput.ts";

it("rejects duplicate option labels and a recommendation outside the available options", () => {
	expect(() => questionTemplate(inboxQuestion.replace("label: Use a database", "label: Keep local files"), "answer")).toThrow("unique");
	expect(() => questionTemplate(inboxQuestion.replace("recommended: Keep local files", "recommended: Another choice"), "answer")).toThrow(
		"option label",
	);
	expect(
		metadataParse(inboxQuestion.replace("description: Store the project documents in a shared database.", "description: ''")).diagnostics,
	).toContainEqual(expect.objectContaining({ field: "options" }));
});

it("validates selected options against captured source and requires a choice or text", () => {
	const input = { author: "Casey", body: "", id: "response.storage", question: "question.storage", type: "answer" as const };
	expect(() => validatedInput(input, inboxQuestion, "answer")).toThrow("requires answers");
	expect(() => validatedInput({ ...input, answers: [{ prompt: "answer", selected: ["missing"], text: "" }] }, inboxQuestion, "answer")).toThrow(
		"not in the reviewed template",
	);
	expect(() => validatedInput({ ...input, answers: [{ prompt: "answer", selected: [], text: "" }] }, inboxQuestion, "answer")).toThrow(
		"selection or additional text",
	);
});
