import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eventually, expectNoReactWarnings, render } from "@shivaedev/effect-react/testing.ts";
import { session } from "#client/session.ts";
import { answerDraft, answerInput, answerPreview, answerPrompt, responseClick } from "#test/answerDraft.tsx";
import { browserStorage } from "#test/browserStorage.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
beforeEach(() => browserStorage());
afterEach(() => {
	window.dispatchEvent(new Event("pagehide"));
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
it("retains new questionnaire choices, text and reviewed context after a save, refresh and reload", async () => {
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
	const view = await render(answerDraft(answerPreview, 0, prompts));
	const native = session(window);
	native.registry.dispose();
	let release: (() => void) | undefined;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const mutate = vi
		.spyOn(native, "mutate")
		.mockResolvedValueOnce({ id: answerPreview.id })
		.mockImplementationOnce(async () => {
			await gate;
			return undefined;
		});
	function choose(value: string) {
		const control = document.querySelector<HTMLInputElement>(`[value="${value}"]`);
		if (!control) {
			throw new Error("Missing choice");
		}
		act(() => {
			control.checked = true;
			control.dispatchEvent(new Event("input", { bubbles: true }));
		});
	}
	try {
		answerInput("author", "reviewer");
		choose("local");
		responseClick("preview");
		await act(async () => responseClick("submit"));
		await eventually(() => expect(mutate).toHaveBeenCalledTimes(2));
		choose("export");
		answerPrompt("direction", "A newer rationale");
		await act(async () => release?.());
		await eventually(() => expect(document.getElementById("response-preview")).toHaveProperty("disabled", false));
		expect(document.querySelector('[value="export"]')).toHaveProperty("checked", true);
		expect(answerPrompt("direction").value).toBe("A newer rationale");
		const revised = { ...answerPreview, id: "question.revised", reviewedRevision: "b".repeat(64) };
		await view.render(answerDraft(revised, 0, prompts));
		expect(document.getElementById("response-status")?.textContent).toContain("Source changed");
		act(() => {
			answerPrompt("direction").focus();
			answerPrompt("direction").setSelectionRange(3, 7, "backward");
		});
		await view.render(answerDraft(revised, 1, prompts));
		expect(answerPrompt("direction").value).toBe("A newer rationale");
		expect(document.activeElement).toBe(answerPrompt("direction"));
		expect([answerPrompt("direction").selectionStart, answerPrompt("direction").selectionEnd]).toEqual([3, 7]);
	} finally {
		release?.();
		await view.unmount();
	}
});
