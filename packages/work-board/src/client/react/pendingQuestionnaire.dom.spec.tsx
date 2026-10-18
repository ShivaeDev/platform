import { Effect } from "effect";
import { act } from "react";
import { afterEach, expect, vi } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/testing.ts";
import { answerClient, answerDraft, answerPreview } from "#test/answerDraft.tsx";
import { recordedResponse, responseCommands } from "#test/responseCommands.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();
afterEach(() => {
	window.dispatchEvent(new Event("pagehide"));
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
screenStory.it(
	"retains new questionnaire choices, text and reviewed context after a save, refresh and reload",
	[],
	function* ({ render, answerInput, responseClick, answerPrompt }) {
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
		const view = yield* Effect.promise(() => render(answerDraft(answerPreview, 0, prompts)));
		let release: (() => void) | undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const { record } = responseCommands(answerClient);
		record.mockImplementationOnce((input) =>
			Effect.promise(async () => {
				await gate;
				return recordedResponse(input);
			}),
		);
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
			yield* Effect.promise(() => act(async () => responseClick("submit")));
			yield* Effect.promise(() => eventually(() => expect(record).toHaveBeenCalledTimes(1)));
			choose("export");
			answerPrompt("direction", "A newer rationale");
			yield* Effect.promise(() => act(async () => release?.()));
			yield* Effect.promise(() => eventually(() => expect(document.getElementById("response-preview")).toHaveProperty("disabled", false)));
			expect(document.querySelector('[value="export"]')).toHaveProperty("checked", true);
			expect(answerPrompt("direction").value).toBe("A newer rationale");
			const revised = { ...answerPreview, id: "question.revised", reviewedRevision: "b".repeat(64) };
			yield* Effect.promise(() => view.render(answerDraft(revised, 0, prompts)));
			expect(document.getElementById("response-status")?.textContent).toContain("Source changed");
			act(() => {
				answerPrompt("direction").focus();
				answerPrompt("direction").setSelectionRange(3, 7, "backward");
			});
			yield* Effect.promise(() => view.render(answerDraft(revised, 1, prompts)));
			expect(answerPrompt("direction").value).toBe("A newer rationale");
			expect(document.activeElement).toBe(answerPrompt("direction"));
			expect([answerPrompt("direction").selectionStart, answerPrompt("direction").selectionEnd]).toEqual([3, 7]);
		} finally {
			release?.();
			yield* Effect.promise(() => view.unmount());
		}
	},
);
