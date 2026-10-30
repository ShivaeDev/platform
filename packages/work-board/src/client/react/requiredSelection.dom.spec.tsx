import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const source = questionnaireSource.replace('select="one"', 'select="one" required="selection"');

screenStory.it(
	"asks for an option before saving text and retains the note when the reader chooses",
	[screenWorkspace("required-selection"), routedScreen({ "proposal.md": source }, "/_board/item/investigation.choices/", { writable: true })],
	function* ({ answerPrompt, check, responseClick, readResponses, readText, findElement }) {
		yield* eventually(() => expect(findElement('[data-prompt="display"]')).not.toBeNull());
		expect(readText('[data-prompt="display"]')).toContain("Choose an option to continue.");
		expect(readText('[data-prompt="display"]')).toContain("Add a note (optional)");
		answerPrompt("display", "Keep the context with the answer.");
		answerPrompt("checks", "Verify navigation.");
		responseClick("submit");
		expect(findElement("[data-answered]")).toBeNull();
		expect(readText('[data-prompt="display"]')).toContain("Choose an option before recording this answer.");
		check("latest");
		responseClick("submit");
		yield* eventually(() => expect(findElement("#response-status")?.dataset.outcome).toBe("saved"));
		const saved = yield* Effect.promise(() => readResponses("investigation.choices", "direction"));
		expect(saved.responses[0]?.response.answers?.[0]).toEqual({
			prompt: "display",
			selected: ["latest"],
			text: "Keep the context with the answer.",
		});
	},
);
