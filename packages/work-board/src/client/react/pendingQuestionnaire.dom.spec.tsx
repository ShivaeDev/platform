import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { answerContext, answerDraft, answerPreview } from "#test/answerDraft.tsx";
import { screenStory } from "#test/screenStory.ts";
import { answerScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const prompts = [
	{
		id: "direction",
		mode: "one" as const,
		options: [
			{ id: "local", source: "Local" },
			{ id: "export", source: "Export" },
		],
		source: "Which?",
	},
];
const context = answerContext(prompts);
screenStory.it(
	"retains new questionnaire choices, text and reviewed context after a save, refresh and reload",
	[answerScreen(context.preview, 0, prompts, context.source)],
	function* ({ responseClick, answerPrompt, check, holdWorkspace, releaseWorkspace, readText, readAttribute, readFocus, selectText, refreshScreen }) {
		check("local");
		responseClick("preview");
		holdWorkspace();
		responseClick("submit");
		yield* eventually(() => expect(readText("#response-status")).toContain("Saving your answer…"));
		check("export");
		answerPrompt("direction", "A newer rationale");
		yield* Effect.promise(releaseWorkspace);
		yield* eventually(() => expect(readText("#response-status")).toContain("Answer saved"));
		expect(readAttribute('[data-choice="export"]', "aria-checked")).toBe("true");
		expect(answerPrompt("direction").value).toBe("A newer rationale");
		const revised = { ...answerPreview, id: "question.revised", reviewedRevision: "b".repeat(64) };
		yield* Effect.promise(() => refreshScreen(answerDraft(revised, 0, prompts)));
		expect(readText("#response-status")).toContain("Source changed");
		selectText(answerPrompt("direction"), 3, 7, "backward");
		yield* Effect.promise(() => refreshScreen(answerDraft(revised, 1, prompts)));
		expect(answerPrompt("direction").value).toBe("A newer rationale");
		expect(readFocus()).toBe(answerPrompt("direction"));
		expect([answerPrompt("direction").selectionStart, answerPrompt("direction").selectionEnd]).toEqual([3, 7]);
	},
);
