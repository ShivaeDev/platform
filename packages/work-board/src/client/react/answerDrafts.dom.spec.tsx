import { Effect } from "effect";
import { act } from "react";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings, type render as renderNode } from "@shivaedev/effect-react/testing.ts";
import { formDraft } from "#client/formDraft.ts";
import { answerClient, answerDraft, answerPreview } from "#test/answerDraft.tsx";
import { responseCommands } from "#test/responseCommands.ts";
import { screenStory } from "#test/screenStory.ts";
import { answerScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
beforeEach(() => {
	document.documentElement.dataset.workspace = "draft-fixture";
});
afterEach(() => {
	window.dispatchEvent(new Event("pagehide"));
	window.localStorage.clear();
	delete document.documentElement.dataset.workspace;
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
function draftKey() {
	const form = document.querySelector("#response-form");
	if (!(form instanceof HTMLFormElement)) {
		throw new Error("Missing form");
	}
	return formDraft("response", form.dataset.item ?? "", form.dataset.request).key;
}
async function unmount(view: Awaited<ReturnType<typeof renderNode>>) {
	await view.unmount();
}
screenStory.it(
	"restores an answer after the React tree and its registries are recreated",
	[answerScreen()],
	function* ({ screen, render, answerInput }) {
		const first = screen();
		answerInput("author", "reviewer");
		answerInput("body", "Direction in progress");
		yield* Effect.promise(() => unmount(first));
		const reloaded = yield* Effect.promise(() => render(answerDraft()));
		try {
			expect(answerInput("body").value).toBe("Direction in progress");
			expect(answerInput("author").value).toBe("reviewer");
		} finally {
			yield* Effect.promise(() => unmount(reloaded));
		}
	},
);
screenStory.it("retains an answer when a live update remounts the same item and request", [answerScreen()], function* ({ screen, answerInput }) {
	const view = screen();
	try {
		answerInput("author", "reviewer");
		answerInput("body", "Direction in progress");
		const key = draftKey();
		yield* Effect.promise(() => view.render(answerDraft({ ...answerPreview, context: "Fresh live context" }, 1)));
		expect(draftKey()).toBe(key);
		expect(answerInput("body").value).toBe("Direction in progress");
	} finally {
		yield* Effect.promise(() => unmount(view));
	}
});
screenStory.it(
	"retains an answer and refreshes its optional preview when its source revision changes",
	[answerScreen()],
	function* ({ screen, responseClick, answerInput }) {
		const view = screen();
		try {
			answerInput("author", "reviewer");
			answerInput("body", "Direction in progress");
			responseClick("preview");
			expect(document.getElementById("response-submit")).toHaveProperty("disabled", false);
			const key = draftKey();
			yield* Effect.promise(() => view.render(answerDraft({ ...answerPreview, id: "question.revised", reviewedRevision: "b".repeat(64) })));
			expect(draftKey()).toBe(key);
			expect(answerInput("body").value).toBe("Direction in progress");
			expect(document.getElementById("response-status")?.textContent).toContain("Source changed");
			expect(document.getElementById("response-status")?.textContent).not.toContain("Preview ready");
			expect(document.getElementById("response-submit")).toHaveProperty("disabled", false);
			responseClick("preview");
			expect(document.getElementById("response-preview-content")?.textContent).toContain("b".repeat(64));
			expect(document.getElementById("response-submit")).toHaveProperty("disabled", false);
		} finally {
			yield* Effect.promise(() => unmount(view));
		}
	},
);
screenStory.it(
	"clears a successfully submitted answer from storage and the next mounted form",
	[answerScreen()],
	function* ({ screen, responseClick, answerInput }) {
		const view = screen();
		const { register, record } = responseCommands(answerClient);
		try {
			answerInput("author", "reviewer");
			answerInput("body", "Direction in progress");
			const key = draftKey();
			expect(window.localStorage.getItem(key)).toContain("Direction in progress");
			responseClick("preview");
			yield* Effect.promise(() => act(async () => responseClick("submit")));
			yield* Effect.promise(() => eventually(() => expect(answerInput("body").value).toBe("")));
			expect(register).toHaveBeenCalledTimes(1);
			expect(record).toHaveBeenCalledTimes(1);
			expect(window.localStorage.getItem(key)).toBeNull();
			yield* Effect.promise(() => view.render(answerDraft(answerPreview, 1)));
			expect(answerInput("body").value).toBe("");
		} finally {
			yield* Effect.promise(() => unmount(view));
		}
	},
);
screenStory.it("clears only the current request draft", [answerScreen()], function* ({ screen, responseClick, answerInput }) {
	const view = screen();
	try {
		answerInput("author", "reviewer");
		answerInput("body", "Direction in progress");
		const first = draftKey();
		yield* Effect.promise(() => view.render(answerDraft({ ...answerPreview, id: "question.other", request: "other" }, 1)));
		answerInput("author", "reviewer");
		answerInput("body", "Direction in progress");
		const second = draftKey();
		responseClick("clear");
		expect(answerInput("body").value).toBe("");
		expect(window.localStorage.getItem(second)).toBeNull();
		expect(window.localStorage.getItem(first)).toContain("Direction in progress");
	} finally {
		yield* Effect.promise(() => unmount(view));
	}
});

screenStory.it(
	"retains the body and caret while a refreshed request gains or loses questionnaire prompts",
	[answerScreen()],
	function* ({ screen, answerInput, answerPrompt, responseClick }) {
		const view = screen();
		try {
			answerInput("author", "reviewer");
			answerInput("body", "Direction in progress");
			const body = answerInput("body");
			act(() => {
				body.focus();
				body.setSelectionRange(4, 9, "backward");
			});
			const revised = { ...answerPreview, id: "question.revised", reviewedRevision: "b".repeat(64) };
			yield* Effect.promise(() => view.render(answerDraft(revised, 0, [{ id: "direction", mode: "text", options: [], source: "Which direction?" }])));
			expect(answerInput("body").value).toBe("Direction in progress");
			expect(document.activeElement).toBe(answerInput("body"));
			expect([answerInput("body").selectionStart, answerInput("body").selectionEnd]).toEqual([4, 9]);
			answerInput("body", "");
			answerPrompt("direction", "Use the local direction");
			responseClick("preview");
			expect(document.getElementById("response-submit")).toHaveProperty("disabled", false);
			yield* Effect.promise(() => view.render(answerDraft(answerPreview)));
			responseClick("preview");
			expect(document.getElementById("response-submit")).toHaveProperty("disabled", false);
			answerInput("body", "A complete response");
			responseClick("preview");
			expect(document.getElementById("response-submit")).toHaveProperty("disabled", false);
			act(() => {
				answerInput("body").focus();
				answerInput("body").setSelectionRange(3, 7, "backward");
			});
			yield* Effect.promise(() => view.render(answerDraft(answerPreview, 1)));
			expect(answerInput("body").value).toBe("A complete response");
			expect(document.activeElement).toBe(answerInput("body"));
			expect([answerInput("body").selectionStart, answerInput("body").selectionEnd]).toEqual([3, 7]);
		} finally {
			yield* Effect.promise(() => unmount(view));
		}
	},
);
