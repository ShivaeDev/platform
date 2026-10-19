import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { questionnaireSource, scopedQuestionnaire } from "#test/questionnaire.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

const SINGLE_REQUEST = 1;
const PACKET_PROMPTS = 2;
const READABLE_OPTIONS = 4;

expectNoReactWarnings();
const URL = "/_board/item/investigation.choices/";
screenStory.it(
	"shows packet controls but disables recording in read-only mode",
	[routedScreen({ "proposal.md": questionnaireSource }, URL, { home: undefined, writable: false })],
	function* ({ findElement, findElements, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElements("#answer-card-direction fieldset")).toHaveLength(PACKET_PROMPTS)));
		expect(findElement("#response-submit")).toHaveProperty("disabled", true);
		expect(readText("#response-status")).toBe("This Board is read-only. Start it with --responses to record answers.");
	},
);

screenStory.it(
	"retains the readable questionnaire when its request is closed",
	[routedScreen({ "proposal.md": questionnaireSource.replace("state: open", "state: closed") }, URL, { home: undefined, writable: true })],
	function* ({ findElement, findElements }) {
		yield* Effect.promise(() => eventually(() => expect(findElements(".questionnaire-option")).toHaveLength(READABLE_OPTIONS)));
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
			yield* Effect.promise(() => eventually(() => expect(findElement("#answer-card-direction [data-prompt=display]")).not.toBeNull()));
			expect(findElement("#answer-card-direction [data-prompt=checks]")).toBeNull();
			if (state === "closed") {
				expect(findElement("#answer-card-verification")).toBeNull();
				expect(findElements(".questionnaire-question")).toHaveLength(SINGLE_REQUEST);
			} else {
				expect(readAttribute("#answer-card-direction fieldset", "data-mode")).toBe("one");
				expect(readAttribute("#answer-card-verification fieldset", "data-mode")).toBe("many");
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
		yield* Effect.promise(() => eventually(() => expect(findElements("fieldset[data-prompt]")).toHaveLength(PACKET_PROMPTS)));
		input('[name="author"]', "maintainer");
		check("history");
		input('[data-prompt="checks"] textarea', "None of these; test keyboard use instead.");
		yield* Effect.promise(() => activate("#response-preview"));
		submit("#response-form");
		yield* Effect.promise(() => eventually(() => expect(readText("#response-history")).toContain("test keyboard use instead")));
		expect(readText("#response-history")).toContain("Chose Full history");
		const saved = yield* Effect.promise(() => readResponses("investigation.choices", "direction"));
		expect(saved.responses).toHaveLength(SINGLE_REQUEST);
		expect(saved.responses[0]?.response.answers).toEqual([
			{ prompt: "display", selected: ["history"], text: "" },
			{ prompt: "checks", selected: [], text: "None of these; test keyboard use instead." },
		]);
	},
);

screenStory.it(
	"retains text but clears changed template selections and exposes the earlier packet",
	[routedScreen({ "proposal.md": questionnaireSource }, URL, { home: undefined, writable: true })],
	function* ({ findElement, input, check, editFile, refreshDocument, readText, readAttribute, submit, activate }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form")).not.toBeNull()));
		input('[name="author"]', "maintainer");
		check("history");
		const rationale = input('[data-prompt="display"] textarea', "Keep this rationale.");
		yield* Effect.promise(() => activate("#response-preview"));
		editFile("proposal.md", questionnaireSource.replace("Full history", "Changed meaning of the same option"));
		yield* Effect.promise(() => refreshDocument());
		yield* Effect.promise(() => eventually(() => expect(readText("#response-status")).toContain("Source changed")));
		expect(readAttribute('[data-choice="history"]', "aria-checked")).toBe("false");
		expect(rationale.value).toBe("Keep this rationale.");
		expect(readText("#response-draft-recovery")).toContain("history");
		submit("#response-form");
		expect(readText("#response-status")).toContain("Unanswered: “Which checks matter?”.");
	},
);
