import { expect, it } from "vitest";
import { validatedInput } from "#responses/validatedInput.ts";
import { responseInput, TEXT_QUESTION } from "#test/coverageEdges.ts";
import { questionnaireAnswers, questionnaireSource } from "#test/questionnaire.ts";

it("rejects reordered answers even when a packet has the correct number of answers", () => {
	expect(() => validatedInput({ ...responseInput, answers: [...questionnaireAnswers].reverse() }, questionnaireSource, "direction")).toThrow(
		"Submit one answer per question, in template order.",
	);
});

it("requires explanatory text for Clarify and Not now rather than treating selections as an explanation", () => {
	for (const type of ["clarify", "not_now"] as const) {
		expect(() =>
			validatedInput(
				{ ...responseInput, answers: questionnaireAnswers.map((answer) => ({ ...answer, text: " " })), type },
				questionnaireSource,
				"direction",
			),
		).toThrow("Clarify / Not now needs explanatory text.");
	}
});

it("rejects whitespace-only ordinary replies with a specific correction", () => {
	expect(() => validatedInput({ ...responseInput, body: " \n\t" }, "# Plain request", "direction")).toThrow(
		"A response needs text or answers to the question packet.",
	);
});

it("bounds the complete recorded packet after adding reviewed Markdown context", () => {
	const context = TEXT_QUESTION.replace("What should happen next?", "x".repeat(32_700));
	expect(() =>
		validatedInput({ ...responseInput, answers: [{ prompt: "next", selected: [], text: "y".repeat(100) }] }, context, "direction"),
	).toThrow("The complete recorded response exceeds 32768 characters. Shorten the response or split the source request.");
});
