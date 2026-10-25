import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { questionnaireSource, scopedQuestionnaire } from "#test/questionnaire.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const URL = "/_board/item/investigation.choices/";
screenStory.it(
	"lists the packet questions and says answering is turned off in read-only mode",
	[routedScreen({ "proposal.md": questionnaireSource }, URL, { home: undefined, writable: false })],
	function* ({ findElement, findElements }) {
		yield* eventually(() =>
			expect(findElements("#answer-card-direction [data-prompt]").map((prompt) => prompt.getAttribute("data-prompt"))).toEqual(["display", "checks"]),
		);
		const card = findElement("#answer-card-direction");
		expect(findElements("form, input, textarea, select, button", card)).toEqual([]);
		expect(findElements('[role="status"]', card).map((status) => status.textContent)).toEqual(["Answering is turned off on this Board."]);
	},
);

screenStory.it(
	"retains the readable questionnaire when its request is closed",
	[routedScreen({ "proposal.md": questionnaireSource.replace("state: open", "state: closed") }, URL, { home: undefined, writable: true })],
	function* ({ findElement, findElements }) {
		yield* eventually(() =>
			expect(findElements(".questionnaire-option").map((option) => option.textContent?.trim())).toEqual([
				"Latest reply — compact, with older replies behind a link.",
				"Full history — keep earlier direction visible.",
				"Back/forward keeps the selected response.",
				"Reload restores the reading context.",
			]),
		);
		expect(findElement("#answer-card-direction")).toBeNull();
		expect(findElement(".questionnaire-answer")).toBeNull();
	},
);

for (const state of ["open", "closed"]) {
	screenStory.it(
		`scopes packet controls when the second request is ${state}`,
		[
			routedScreen({ "proposal.md": scopedQuestionnaire.replace("kind: review\n    state: open", `kind: review\n    state: ${state}`) }, URL, {
				home: undefined,
				writable: true,
			}),
		],
		function* ({ findElement, findElements, readAttribute }) {
			yield* eventually(() => expect(findElement("#answer-card-direction [data-prompt=display]")).not.toBeNull());
			expect(findElement("#answer-card-direction [data-prompt=checks]")).toBeNull();
			if (state === "closed") {
				expect(findElement("#answer-card-verification")).toBeNull();
				expect(findElements(".questionnaire-question").map((prompt) => prompt.querySelector("h3")?.textContent)).toEqual(["Which checks matter?"]);
			} else {
				expect(readAttribute("#answer-card-direction fieldset[data-mode]", "data-mode")).toBe("one");
				expect(readAttribute("#answer-card-verification fieldset[data-mode]", "data-mode")).toBe("many");
				const ids = findElements(".answer-cards [id]").map((element) => element.id);
				expect(new Set(ids).size).toBe(ids.length);
			}
		},
	);
}

screenStory.it(
	"records choices and human text for every questionnaire prompt in one batch",
	[
		routedScreen({ "proposal.md": questionnaireSource }, URL, {
			home: undefined,
			writable: true,
		}),
	],
	function* ({ findElements, input, check, activate, submit, readText, readResponses }) {
		yield* eventually(() =>
			expect(findElements("fieldset[data-prompt]").map((prompt) => prompt.getAttribute("data-prompt"))).toEqual(["display", "checks"]),
		);
		check("history");
		input('[data-prompt="checks"] textarea', "None of these; test keyboard use instead.");
		yield* Effect.promise(() => activate("#response-preview"));
		submit("#response-form");
		yield* eventually(() => expect(readText("#response-history")).toContain("test keyboard use instead"));
		expect(readText("#response-history")).toContain("Chose Full history");
		const saved = yield* Effect.promise(() => readResponses("investigation.choices", "direction"));
		expect(saved.responses.map((entry) => entry.response.answers)).toEqual([
			[
				{ prompt: "display", selected: ["history"], text: "" },
				{ prompt: "checks", selected: [], text: "None of these; test keyboard use instead." },
			],
		]);
	},
);

screenStory.it(
	"retains text but clears changed template selections and exposes the earlier packet",
	[routedScreen({ "proposal.md": questionnaireSource }, URL, { home: undefined, writable: true })],
	function* ({ findElement, input, check, editFile, refreshDocument, readText, readAttribute, submit, activate }) {
		yield* eventually(() => expect(findElement("#response-form")).not.toBeNull());
		check("history");
		const rationale = input('[data-prompt="display"] textarea', "Keep this rationale.");
		yield* Effect.promise(() => activate("#response-preview"));
		editFile("proposal.md", questionnaireSource.replace("Full history", "Changed meaning of the same option"));
		yield* Effect.promise(() => refreshDocument());
		yield* eventually(() => expect(readText("#response-status")).toContain("Source changed"));
		expect(readAttribute('[data-choice="history"]', "aria-checked")).toBe("false");
		expect(rationale.value).toBe("Keep this rationale.");
		expect(readText("#response-draft-recovery")).toContain("history");
		submit("#response-form");
		expect(readText("#response-status")).toContain("Unanswered: “Which checks matter?”.");
	},
);
