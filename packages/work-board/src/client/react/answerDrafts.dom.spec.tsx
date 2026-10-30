import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { answerDraft, answerPreview } from "#test/answerDraft.tsx";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { answerScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"restores an answer after the React tree and its registries are recreated",
	[screenWorkspace("draft-fixture"), answerScreen()],
	function* ({ render, answerInput, closeScreen }) {
		answerInput("body", "Direction in progress");
		yield* Effect.promise(() => closeScreen());
		yield* Effect.promise(() => render(answerDraft()));

		expect(answerInput("body").value).toBe("Direction in progress");
	},
);
screenStory.it(
	"retains an answer when a live update remounts the same item and request",
	[screenWorkspace("draft-fixture"), answerScreen()],
	function* ({ answerInput, draftKey, refreshScreen }) {
		answerInput("body", "Direction in progress");
		const key = draftKey();
		yield* Effect.promise(() => refreshScreen(answerDraft({ ...answerPreview, context: "Fresh live context" }, 1)));
		expect(draftKey()).toBe(key);
		expect(answerInput("body").value).toBe("Direction in progress");
	},
);
screenStory.it(
	"retains an answer and refreshes its optional preview when its source revision changes",
	[screenWorkspace("draft-fixture"), answerScreen()],
	function* ({ responseClick, answerInput, findElement, readText, draftKey, refreshScreen }) {
		answerInput("body", "Direction in progress");
		responseClick("preview");
		expect(findElement("#response-submit")).toHaveProperty("disabled", false);
		const key = draftKey();
		yield* Effect.promise(() => refreshScreen(answerDraft({ ...answerPreview, id: "question.revised", reviewedRevision: "b".repeat(64) })));
		expect(draftKey()).toBe(key);
		expect(answerInput("body").value).toBe("Direction in progress");
		expect(readText("#response-status")).toContain("Source changed");
		expect(readText("#response-status")).not.toContain("Preview ready");
		expect(findElement("#response-submit")).toHaveProperty("disabled", false);
		responseClick("preview");
		expect(readText("#response-preview-content")).toContain("b".repeat(64));
		expect(findElement("#response-submit")).toHaveProperty("disabled", false);
	},
);
screenStory.it(
	"clears a successfully submitted answer from storage and the next mounted form",
	[screenWorkspace("draft-fixture"), answerScreen()],
	function* ({ readResponses, responseClick, answerInput, draftKey, stored, refreshScreen }) {
		answerInput("body", "Direction in progress");
		const key = draftKey();
		expect(stored(key)).toContain("Direction in progress");
		responseClick("preview");
		yield* Effect.promise(async () => responseClick("submit"));
		yield* eventually(() => expect(answerInput("body").value).toBe(""));
		const saved = yield* Effect.promise(() => readResponses("item.fixture", "direction"));
		expect(saved.responses.map((entry) => entry.body)).toEqual(["Direction in progress"]);
		expect(stored(key)).toBeNull();
		yield* Effect.promise(() => refreshScreen(answerDraft(answerPreview, 1)));
		expect(answerInput("body").value).toBe("");
	},
);
screenStory.it(
	"clears only the current request draft",
	[screenWorkspace("draft-fixture"), answerScreen()],
	function* ({ responseClick, answerInput, draftKey, stored, refreshScreen, readText }) {
		answerInput("body", "Direction in progress");
		const first = draftKey();
		yield* Effect.promise(() => refreshScreen(answerDraft({ ...answerPreview, id: "question.other", request: "other" }, 1)));
		answerInput("body", "Direction in progress");
		const second = draftKey();
		responseClick("clear");
		expect(answerInput("body").value).toBe("");
		expect(readText("#response-status")).toBe("Draft cleared. Saved responses are unchanged.");
		expect(stored(second)).toBeNull();
		expect(stored(first)).toContain("Direction in progress");
	},
);

screenStory.it(
	"retains the body and caret while a refreshed request gains or loses questionnaire prompts",
	[screenWorkspace("draft-fixture"), answerScreen()],
	function* ({ answerInput, answerPrompt, responseClick, readFocus, findElement, selectText, refreshScreen }) {
		answerInput("body", "Direction in progress");
		const body = answerInput("body");
		selectText(body, 4, 9, "backward");
		const revised = { ...answerPreview, id: "question.revised", reviewedRevision: "b".repeat(64) };
		yield* Effect.promise(() => refreshScreen(answerDraft(revised, 0, [{ id: "direction", mode: "text", options: [], source: "Which direction?" }])));
		expect(answerInput("body").value).toBe("Direction in progress");
		expect(readFocus()).toBe(answerInput("body"));
		expect([answerInput("body").selectionStart, answerInput("body").selectionEnd]).toEqual([4, 9]);
		answerInput("body", "");
		answerPrompt("direction", "Use the local direction");
		responseClick("preview");
		expect(findElement("#response-submit")).toHaveProperty("disabled", false);
		yield* Effect.promise(() => refreshScreen(answerDraft(answerPreview)));
		responseClick("preview");
		expect(findElement("#response-submit")).toHaveProperty("disabled", false);
		answerInput("body", "A complete response");
		responseClick("preview");
		expect(findElement("#response-submit")).toHaveProperty("disabled", false);
		selectText(answerInput("body"), 3, 7, "backward");
		yield* Effect.promise(() => refreshScreen(answerDraft(answerPreview, 1)));
		expect(answerInput("body").value).toBe("A complete response");
		expect(readFocus()).toBe(answerInput("body"));
		expect([answerInput("body").selectionStart, answerInput("body").selectionEnd]).toEqual([3, 7]);
	},
);
