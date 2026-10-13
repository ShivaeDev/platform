import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings, render } from "@shivaedev/effect-react/testing.ts";
import { formDraft } from "#client/formDraft.ts";
import { session } from "#client/session.ts";
import { answerDraft, answerInput, answerPreview, answerPrompt, responseClick } from "#test/answerDraft.tsx";
import { browserStorage } from "#test/browserStorage.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
beforeEach(() => {
	browserStorage();
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
function editAnswer() {
	answerInput("author", "reviewer");
	answerInput("body", "Direction in progress");
}
async function unmount(view: Awaited<ReturnType<typeof render>>) {
	await view.unmount();
}
it("restores an answer after the React tree and its registries are recreated", async () => {
	const first = await render(answerDraft());
	editAnswer();
	await unmount(first);
	const reloaded = await render(answerDraft());
	try {
		expect(answerInput("body").value).toBe("Direction in progress");
		expect(answerInput("author").value).toBe("reviewer");
	} finally {
		await unmount(reloaded);
	}
});
it("retains an answer when a live update remounts the same item and request", async () => {
	const view = await render(answerDraft());
	try {
		editAnswer();
		const key = draftKey();
		await view.render(answerDraft({ ...answerPreview, context: "Fresh live context" }, 1));
		expect(draftKey()).toBe(key);
		expect(answerInput("body").value).toBe("Direction in progress");
	} finally {
		await unmount(view);
	}
});
it("retains an answer and requires a fresh preview when its source revision changes", async () => {
	const view = await render(answerDraft());
	try {
		editAnswer();
		responseClick("preview");
		expect(document.getElementById("response-submit")).toHaveProperty("disabled", false);
		const key = draftKey();
		await view.render(answerDraft({ ...answerPreview, id: "question.revised", reviewedRevision: "b".repeat(64) }));
		expect(draftKey()).toBe(key);
		expect(answerInput("body").value).toBe("Direction in progress");
		expect(document.getElementById("response-status")?.textContent).toContain("Source changed");
		expect(document.getElementById("response-submit")).toHaveProperty("disabled", true);
		responseClick("preview");
		expect(document.getElementById("response-preview-content")?.textContent).toContain("b".repeat(64));
		expect(document.getElementById("response-submit")).toHaveProperty("disabled", false);
	} finally {
		await unmount(view);
	}
});
it("clears a successfully submitted answer from storage and the next mounted form", async () => {
	const view = await render(answerDraft());
	const native = session(window);
	native.registry.dispose();
	const mutate = vi.spyOn(native, "mutate").mockResolvedValue({ id: "question.fixture" });
	try {
		editAnswer();
		const key = draftKey();
		expect(window.localStorage.getItem(key)).toContain("Direction in progress");
		responseClick("preview");
		await act(async () => responseClick("submit"));
		await eventually(() => expect(answerInput("body").value).toBe(""));
		expect(mutate).toHaveBeenCalledTimes(2);
		expect(window.localStorage.getItem(key)).toBeNull();
		await view.render(answerDraft(answerPreview, 1));
		expect(answerInput("body").value).toBe("");
	} finally {
		await unmount(view);
	}
});
it("clears only the current request draft", async () => {
	const view = await render(answerDraft());
	try {
		editAnswer();
		const first = draftKey();
		await view.render(answerDraft({ ...answerPreview, id: "question.other", request: "other" }, 1));
		editAnswer();
		const second = draftKey();
		responseClick("clear");
		expect(answerInput("body").value).toBe("");
		expect(window.localStorage.getItem(second)).toBeNull();
		expect(window.localStorage.getItem(first)).toContain("Direction in progress");
	} finally {
		await unmount(view);
	}
});

it("retains the body and caret while a refreshed request gains or loses questionnaire prompts", async () => {
	const view = await render(answerDraft());
	try {
		editAnswer();
		const body = answerInput("body");
		act(() => {
			body.focus();
			body.setSelectionRange(4, 9, "backward");
		});
		const revised = { ...answerPreview, id: "question.revised", reviewedRevision: "b".repeat(64) };
		await view.render(answerDraft(revised, 0, [{ id: "direction", mode: "text", options: [], source: "Which direction?" }]));
		expect(answerInput("body").value).toBe("Direction in progress");
		expect(document.activeElement).toBe(answerInput("body"));
		expect([answerInput("body").selectionStart, answerInput("body").selectionEnd]).toEqual([4, 9]);
		answerInput("body", "");
		answerPrompt("direction", "Use the local direction");
		responseClick("preview");
		expect(document.getElementById("response-submit")).toHaveProperty("disabled", false);
		await view.render(answerDraft(answerPreview));
		responseClick("preview");
		expect(document.getElementById("response-submit")).toHaveProperty("disabled", true);
		answerInput("body", "A complete response");
		responseClick("preview");
		expect(document.getElementById("response-submit")).toHaveProperty("disabled", false);
		act(() => {
			answerInput("body").focus();
			answerInput("body").setSelectionRange(3, 7, "backward");
		});
		await view.render(answerDraft(answerPreview, 1));
		expect(answerInput("body").value).toBe("A complete response");
		expect(document.activeElement).toBe(answerInput("body"));
		expect([answerInput("body").selectionStart, answerInput("body").selectionEnd]).toEqual([3, 7]);
	} finally {
		await unmount(view);
	}
});
