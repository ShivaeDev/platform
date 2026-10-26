import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { questionOptionMarkdown } from "#test/questionOptionMarkdown.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
screenStory.it(
	"renders question prompts and option bodies as Markdown and records the selected option with free text",
	[
		routedScreen({ "question.md": questionOptionMarkdown(), "task.md": "# Affected work" }, "/_board/item/question.reading/", {
			home: undefined,
			writable: true,
		}),
	],
	function* ({ findElement, findElements, readText, readAttribute, check, input, submit, readResponses }) {
		yield* eventually(() => expect(readText('[data-prompt="display"] legend strong')).toBe("replies"));
		const prompt = findElement('[data-prompt="display"]');
		const body = findElement(":scope > div", prompt);
		expect(readText("strong", body)).toBe("context");
		expect(readText("code", body)).toBe("responses");
		expect(readAttribute("a", "href", body)).toBe("/task.md");
		expect(findElements("ul > li", body).map((item) => item.textContent)).toEqual(["Read the proposal.", "Choose a direction."]);
		const option = findElement('[data-choice="history"]')?.closest(".question-choice");
		expect(readText("p strong", option)).toBe("earlier direction");
		expect(readText("code", option)).toBe("responses");
		expect(readAttribute("a", "href", option)).toBe("/task.md");
		expect(findElements("ul > li", option).map((item) => item.textContent)).toEqual(["Preserve the reasoning.", "Show previous replies."]);
		expect(option?.textContent).not.toMatch(/[*`]/u);
		expect(readText("legend", prompt)).not.toContain("**");
		check("history");
		expect(readAttribute('[data-choice="history"]', "aria-checked")).toBe("true");
		input('[data-prompt="display"] textarea', "Keep the reasoning visible.");
		submit("#response-form");
		yield* eventually(() => expect(readText("#response-status")).toContain("Answer saved"));
		const saved = yield* Effect.promise(() => readResponses("question.reading", "answer"));
		expect(saved.responses.map((entry) => entry.response.answers)).toEqual([
			[{ prompt: "display", selected: ["history"], text: "Keep the reasoning visible." }],
		]);
	},
);
