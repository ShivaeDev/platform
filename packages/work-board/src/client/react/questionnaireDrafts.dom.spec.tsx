import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { expectNoReactWarnings, render } from "@shivaedev/effect-react/client/testing.ts";
import { formDraft } from "#client/formDraft.ts";
import { answerDraft, answerInput, answerPreview, answerPrompt, responseClick } from "#test/answerDraft.tsx";
import { browserStorage } from "#test/browserStorage.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
const prompts = [
	{ id: "direction", mode: "text" as const, options: [], source: "Which direction?" },
	{ id: "checks", mode: "text" as const, options: [], source: "Which checks?" },
];
const revised = { ...answerPreview, id: "question.revised", reviewedRevision: "b".repeat(64) };
beforeEach(() => {
	browserStorage();
	document.documentElement.dataset.workspace = "questionnaire-fixture";
});
afterEach(() => {
	window.dispatchEvent(new Event("pagehide"));
	vi.unstubAllGlobals();
	delete document.documentElement.dataset.workspace;
});
function draftKey() {
	const form = document.getElementById("response-form");
	if (!(form instanceof HTMLFormElement)) {
		throw new Error("Missing form");
	}
	return formDraft("response", form.dataset.item ?? "", form.dataset.request).key;
}
function stored() {
	return window.localStorage.getItem(draftKey());
}
function recovery() {
	return document.getElementById("response-draft-recovery")?.textContent ?? "";
}
async function unmount(view: Awaited<ReturnType<typeof render>>) {
	await view.unmount();
}
it("keeps questionnaire input and storage size stable through repeated revised-context remounts before preview", async () => {
	const text = "Direction in progress. ".repeat(300);
	const checks = "Checks in progress. ".repeat(300);
	const first = await render(answerDraft(answerPreview, 0, prompts));
	answerInput("author", "reviewer");
	answerInput("body", "Overall direction");
	answerPrompt("direction", text);
	answerPrompt("checks", checks);
	await unmount(first);
	let bytes: number | undefined;
	let retained: string | undefined;
	let snapshot: string | undefined;
	for (let index = 0; index < 30; index += 1) {
		const view = await render(answerDraft(revised, index, prompts));
		try {
			expect(answerInput("body").value).toBe("Overall direction");
			expect(answerPrompt("direction").value).toBe(text);
			expect(answerPrompt("checks").value).toBe(checks);
			expect(document.getElementById("response-submit")).toHaveProperty("disabled", false);
			const raw = stored();
			expect(raw).not.toBeNull();
			const size = new TextEncoder().encode(raw ?? "").byteLength;
			bytes ??= size;
			snapshot ??= raw ?? "";
			expect(raw).toBe(snapshot);
			retained ??= recovery();
			expect(size).toBe(bytes);
			expect(recovery()).toBe(retained);
			expect(recovery()).toContain(text);
		} finally {
			await unmount(view);
		}
	}
});
it("does not create or persist recovery for untouched questionnaire answers", async () => {
	const view = await render(answerDraft(answerPreview, 0, prompts));
	try {
		expect(recovery()).toBe("");
		expect(stored()).toBeNull();
		answerInput("author", "reviewer");
		await view.render(answerDraft(revised, 1, prompts));
		expect(recovery()).toBe("");
		expect(document.getElementById("response-draft-recovery")).toHaveProperty("hidden", true);
	} finally {
		await unmount(view);
	}
});
it("updates one recovery entry per prior context when a context is revisited", async () => {
	const view = await render(answerDraft(answerPreview, 0, prompts));
	try {
		answerInput("author", "reviewer");
		answerPrompt("direction", "First direction");
		answerPrompt("checks", "First checks");
		await view.render(answerDraft(revised, 1, prompts));
		expect(recovery().match(/Earlier template answers/gu)).toHaveLength(1);
		responseClick("preview");
		const third = { ...answerPreview, id: "question.third", reviewedRevision: "c".repeat(64) };
		await view.render(answerDraft(third, 2, prompts));
		expect(recovery().match(/Earlier template answers/gu)).toHaveLength(2);
		await view.render(answerDraft(answerPreview, 3, prompts));
		responseClick("preview");
		answerPrompt("direction", "Revised direction");
		await view.render(answerDraft(revised, 4, prompts));
		expect(recovery().match(/Earlier template answers/gu)).toHaveLength(2);
		expect(recovery()).toContain("Revised direction");
		expect(answerPrompt("direction").value).toBe("Revised direction");
	} finally {
		await unmount(view);
	}
});

it("retains existing recovery strings without copying their duplicate snapshots", async () => {
	const view = await render(answerDraft(answerPreview, 0, prompts));
	try {
		answerInput("author", "reviewer");
		answerPrompt("direction", "Existing direction");
		answerPrompt("checks", "Existing checks");
		await view.render(answerDraft(revised, 1, prompts));
		const record: unknown = JSON.parse(stored() ?? "null");
		if (typeof record !== "object" || record === null || !("values" in record) || typeof record.values !== "object" || record.values === null) {
			throw new Error("Missing stored form values");
		}
		const answers = prompts.map((prompt) => ({ prompt: prompt.id, selected: [], text: answerPrompt(prompt.id).value }));
		const block = `Earlier template answers (selections cleared; review before choosing again):\n${JSON.stringify(answers, null, 2)}\n`;
		Object.assign(record.values, { recovery: `${block.repeat(3)}Older unrelated answer` });
		const legacy = JSON.stringify(record);
		window.localStorage.setItem(draftKey(), legacy);
		await view.render(answerDraft(revised, 2, prompts));
		expect(answerPrompt("direction").value).toBe("Existing direction");
		expect(recovery().match(/Earlier template answers/gu)).toHaveLength(1);
		expect(recovery()).toContain("Older unrelated answer");
		expect(new TextEncoder().encode(stored() ?? "").byteLength).toBeLessThan(new TextEncoder().encode(legacy).byteLength);
	} finally {
		await unmount(view);
	}
});

it("retains new choices made against changed source through preview and reload", async () => {
	const choices = [{ id: "direction", mode: "one" as const, options: [{ id: "local", source: "Keep local" }], source: "Which direction?" }];
	const view = await render(answerDraft(answerPreview, 0, choices));
	function select() {
		const input = document.querySelector<HTMLInputElement>('[value="local"]');
		if (!input) {
			throw new Error("Missing choice");
		}
		act(() => {
			input.checked = true;
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
	}
	try {
		answerInput("author", "reviewer");
		select();
		await view.render(answerDraft(revised, 0, choices));
		expect(document.querySelector('[value="local"]')).toHaveProperty("checked", false);
		select();
		expect(document.querySelector('[value="local"]')).toHaveProperty("checked", true);
		expect(document.getElementById("response-status")?.textContent).toContain("Source changed");
		answerPrompt("direction", "A revised rationale");
		responseClick("preview");
		expect(document.getElementById("response-submit")).toHaveProperty("disabled", false);
		act(() => {
			answerPrompt("direction").focus();
			answerPrompt("direction").setSelectionRange(3, 7, "backward");
		});
		await view.render(answerDraft(revised, 1, choices));
		expect(answerPrompt("direction").value).toBe("A revised rationale");
		expect(document.activeElement).toBe(answerPrompt("direction"));
		expect([answerPrompt("direction").selectionStart, answerPrompt("direction").selectionEnd]).toEqual([3, 7]);
		expect(document.querySelector('[value="local"]')).toHaveProperty("checked", true);
	} finally {
		await unmount(view);
	}
});
