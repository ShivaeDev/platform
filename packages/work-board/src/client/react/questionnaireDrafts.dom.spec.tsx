import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { answerDraft, answerPreview } from "#test/answerDraft.tsx";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { answerScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const prompts = [
	{ id: "direction", mode: "text" as const, options: [], source: "Which direction?" },
	{ id: "checks", mode: "text" as const, options: [], source: "Which checks?" },
];
const revised = { ...answerPreview, id: "question.revised", reviewedRevision: "b".repeat(64) };

const text = "Direction in progress. ".repeat(300);
const checks = "Checks in progress. ".repeat(300);
screenStory.it(
	"keeps questionnaire input and storage size stable through repeated revised-context remounts before preview",
	[screenWorkspace("questionnaire-fixture"), answerScreen(answerPreview, 0, prompts)],
	function* ({ render, answerInput, answerPrompt, findElement, closeScreen, readStoredDraft, readDraftRecovery }) {
		answerInput("body", "Overall direction");
		answerPrompt("direction", text);
		answerPrompt("checks", checks);
		yield* Effect.promise(() => closeScreen());
		let bytes: number | undefined;
		let retained: string | undefined;
		let snapshot: string | undefined;
		for (let index = 0; index < 30; index += 1) {
			yield* Effect.promise(() => render(answerDraft(revised, index, prompts)));

			expect(answerInput("body").value).toBe("Overall direction");
			expect(answerPrompt("direction").value).toBe(text);
			expect(answerPrompt("checks").value).toBe(checks);
			expect(findElement("#response-submit")).toHaveProperty("disabled", false);
			const raw = readStoredDraft();
			expect(raw).not.toBeNull();
			const size = new TextEncoder().encode(raw ?? "").byteLength;
			bytes ??= size;
			snapshot ??= raw ?? "";
			expect(raw).toBe(snapshot);
			retained ??= readDraftRecovery();
			expect(size).toBe(bytes);
			expect(readDraftRecovery()).toBe(retained);
			expect(readDraftRecovery()).toContain(text);
		}
	},
);
screenStory.it(
	"does not create or persist recovery for untouched questionnaire answers",
	[screenWorkspace("questionnaire-fixture"), answerScreen(answerPreview, 0, prompts)],
	function* ({ findElement, readDraftRecovery, readStoredDraft, refreshScreen }) {
		expect(readDraftRecovery()).toBe("");
		expect(readStoredDraft()).toBeNull();
		yield* Effect.promise(() => refreshScreen(answerDraft(revised, 1, prompts)));
		expect(readDraftRecovery()).toBe("");
		expect(findElement("#response-draft-recovery")).toHaveProperty("hidden", true);
	},
);
screenStory.it(
	"updates one recovery entry per prior context when a context is revisited",
	[screenWorkspace("questionnaire-fixture"), answerScreen(answerPreview, 0, prompts)],
	function* ({ answerPrompt, responseClick, readDraftRecovery, readDraftRecoveries, refreshScreen }) {
		answerPrompt("direction", "First direction");
		answerPrompt("checks", "First checks");
		yield* Effect.promise(() => refreshScreen(answerDraft(revised, 1, prompts)));
		const original = readDraftRecoveries();
		expect(original).toEqual([expect.stringContaining('"text": "First direction"')]);
		responseClick("preview");
		const third = { ...answerPreview, id: "question.third", reviewedRevision: "c".repeat(64) };
		yield* Effect.promise(() => refreshScreen(answerDraft(third, 2, prompts)));
		const revisited = readDraftRecoveries();
		expect(revisited).toEqual([...original, expect.stringContaining(`Reviewed context: ${JSON.stringify([revised.id, revised.reviewedRevision])}`)]);
		yield* Effect.promise(() => refreshScreen(answerDraft(answerPreview, 3, prompts)));
		responseClick("preview");
		answerPrompt("direction", "Revised direction");
		yield* Effect.promise(() => refreshScreen(answerDraft(revised, 4, prompts)));
		expect(readDraftRecoveries()).toEqual([expect.stringContaining('"text": "Revised direction"'), revisited[1]]);
		expect(readDraftRecovery()).toContain("Revised direction");
		expect(answerPrompt("direction").value).toBe("Revised direction");
	},
);

screenStory.it(
	"retains existing recovery strings without copying their duplicate snapshots",
	[screenWorkspace("questionnaire-fixture"), answerScreen(answerPreview, 0, prompts)],
	function* ({ answerPrompt, readStoredDraft, rememberStored, readDraftRecovery, readDraftRecoveries, draftKey, refreshScreen }) {
		answerPrompt("direction", "Existing direction");
		answerPrompt("checks", "Existing checks");
		yield* Effect.promise(() => refreshScreen(answerDraft(revised, 1, prompts)));
		const record: unknown = JSON.parse(readStoredDraft() ?? "null");
		if (typeof record !== "object" || record === null || !("values" in record) || typeof record.values !== "object" || record.values === null) {
			throw new Error("Missing stored form values");
		}
		const answers = prompts.map((prompt) => ({ prompt: prompt.id, selected: [], text: answerPrompt(prompt.id).value }));
		const block = `Earlier template answers (selections cleared; review before choosing again):\n${JSON.stringify(answers, null, 2)}\n`;
		Object.assign(record.values, { recovery: `${block.repeat(3)}Older unrelated answer` });
		const legacy = JSON.stringify(record);
		rememberStored(draftKey(), legacy);
		yield* Effect.promise(() => refreshScreen(answerDraft(revised, 2, prompts)));
		expect(answerPrompt("direction").value).toBe("Existing direction");
		expect(readDraftRecoveries()).toEqual([expect.stringContaining('"text": "Existing direction"')]);
		expect(readDraftRecovery()).toContain("Older unrelated answer");
		expect(new TextEncoder().encode(readStoredDraft() ?? "").byteLength).toBeLessThan(new TextEncoder().encode(legacy).byteLength);
	},
);

const choices = [{ id: "direction", mode: "one" as const, options: [{ id: "local", source: "Keep local" }], source: "Which direction?" }];
screenStory.it(
	"retains new choices made against changed source through preview and reload",
	[screenWorkspace("questionnaire-fixture"), answerScreen(answerPreview, 0, choices)],
	function* ({ answerPrompt, responseClick, findElement, readAttribute, readText, readFocus, selectText, check, refreshScreen }) {
		check("local");
		yield* Effect.promise(() => refreshScreen(answerDraft(revised, 0, choices)));
		expect(readAttribute('[data-choice="local"]', "aria-checked")).toBe("false");
		check("local");
		expect(readAttribute('[data-choice="local"]', "aria-checked")).toBe("true");
		expect(readText("#response-status")).toContain("Source changed");
		answerPrompt("direction", "A revised rationale");
		responseClick("preview");
		expect(findElement("#response-submit")).toHaveProperty("disabled", false);
		selectText(answerPrompt("direction"), 3, 7, "backward");
		yield* Effect.promise(() => refreshScreen(answerDraft(revised, 1, choices)));
		expect(answerPrompt("direction").value).toBe("A revised rationale");
		expect(readFocus()).toBe(answerPrompt("direction"));
		expect([answerPrompt("direction").selectionStart, answerPrompt("direction").selectionEnd]).toEqual([3, 7]);
		expect(readAttribute('[data-choice="local"]', "aria-checked")).toBe("true");
	},
);
