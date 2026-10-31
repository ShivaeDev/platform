import { Effect, Predicate } from "effect";
import { act } from "react";
import type { Prompt } from "#browser/responses/Prompt.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import { formDraft } from "#client/formDraft.ts";
import { answerDraft, answerPreview } from "./answerDraft.tsx";
import { renderBoard } from "./react.tsx";
import { renderRouter } from "./renderRouter.tsx";
import type { ScreenEngine } from "./screenEngine.ts";
import { trackScreen } from "./screenEngine.ts";
import { screenClient, screenContent } from "./screenFeatures.tsx";
import { screenOptions } from "./screenReads.ts";
import { screenSettles } from "./screenSettle.ts";

function revisionName(preview: QuestionPreview) {
	return `${preview.id} at revision ${preview.reviewedRevision.slice(0, 8)}`;
}

function storedDraftKey() {
	const form = document.querySelector<HTMLFormElement>("#response-form");
	if (!form) {
		throw new Error("The page shows no answer form");
	}
	return formDraft(() => 0, "response", form.dataset.item ?? "", form.dataset.request).key;
}

function storedRecord(key: string) {
	const record: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
	return Predicate.isObject(record) ? record : undefined;
}

function earlierAnswers(recovery: unknown) {
	if (!Predicate.isObject(recovery)) {
		return { legacy: typeof recovery === "string" ? recovery : "none", versions: [] };
	}
	const contexts = Array.isArray(recovery.contexts) ? recovery.contexts : [];
	return {
		legacy: typeof recovery.legacy === "string" ? recovery.legacy : "none",
		versions: contexts.map((context: unknown) => (Predicate.isObject(context) ? context.text : undefined)),
	};
}

function buttonState(button: HTMLButtonElement | null) {
	if (button === null) {
		return "missing";
	}
	return button.disabled ? "disabled" : "enabled";
}

function reopenRouter(engine: ScreenEngine) {
	return renderRouter(
		engine.files,
		engine.path,
		screenOptions(engine, engine.options),
		(api) => screenClient(engine, api),
		(node) => screenContent(engine, node),
	);
}

function reopenAnswerDraft(engine: ScreenEngine, preview: QuestionPreview, prompts: readonly Prompt[]) {
	return renderBoard(
		engine.files,
		(api) => {
			screenClient(engine, api);
			return screenContent(engine, answerDraft(preview, 0, prompts));
		},
		screenOptions(engine, engine.options),
	);
}

export function answerDraftVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	function settle() {
		return screenSettles(engine, tell);
	}
	function read<T>(line: string, value: () => T) {
		return Effect.sync(() => {
			tell(line);
			return value();
		});
	}
	function view() {
		if (!engine.view) {
			throw new Error("No answer card is open");
		}
		return engine.view;
	}
	return {
		answerCardRefreshes: (preview: QuestionPreview, prompts: readonly Prompt[] = [], remount = 0) =>
			Effect.sync(() =>
				tell(
					`the answer card receives ${revisionName(preview)}${prompts.length > 0 ? ` with prompts ${prompts.map(({ id }) => id).join(", ")}` : ""}${remount > 0 ? ", remounting it" : ""}`,
				),
			).pipe(Effect.andThen(Effect.promise(() => view().render(answerDraft(preview, remount, prompts)))), Effect.andThen(settle())),
		answerPreviewText: () =>
			read("the reader reads the answer file preview", () => document.querySelector("#response-preview-content")?.textContent ?? "none"),
		earlierAnswers: () =>
			read("the reader looks for earlier answers kept for recovery", () => {
				const recovery = document.getElementById("response-draft-recovery");
				return recovery === null || recovery.hidden ? "hidden" : (recovery.textContent ?? "");
			}),
		questionnaireDraft: () =>
			read("the reader reads the questionnaire's answers, its earlier answers and what the browser stores for it", () => {
				const recovery = document.getElementById("response-draft-recovery");
				return {
					answers: Object.fromEntries(
						[...document.querySelectorAll<HTMLTextAreaElement>("#response-form [name='body'], [data-prompt] textarea")].map((box) => [
							box.closest<HTMLElement>("[data-prompt]")?.dataset.prompt ?? "own words",
							box.value,
						]),
					),
					earlier: recovery === null || recovery.hidden ? "hidden" : (recovery.textContent ?? ""),
					stored: localStorage.getItem(storedDraftKey()) ?? "nothing stored",
				};
			}),
		recordButton: () =>
			read("the reader checks whether Record answer can be pressed", () => {
				const button = document.querySelector<HTMLButtonElement>("#response-form button[type='submit']");
				return buttonState(button);
			}),
		reloadPage: () =>
			Effect.sync(() => tell(`the reader reloads ${engine.path}`)).pipe(
				Effect.andThen(Effect.promise(() => act(async () => window.dispatchEvent(new Event("pagehide"))))),
				Effect.andThen(Effect.promise(() => view().unmount())),
				Effect.andThen(Effect.promise(() => reopenRouter(engine))),
				Effect.tap((reopened) =>
					Effect.sync(() => {
						engine.router = reopened.router;
						trackScreen(engine, reopened, tell);
					}),
				),
				Effect.andThen(settle()),
				// The page restores the draft's focus and selection in an animation frame after the route settles.
				Effect.andThen(Effect.promise(() => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))))),
				Effect.andThen(settle()),
			),
		reopenAnswerCard: (preview = answerPreview, prompts: readonly Prompt[] = []) =>
			Effect.sync(() => tell(`the reader closes the page and opens the answer card for ${revisionName(preview)} again in a fresh React tree`)).pipe(
				Effect.andThen(Effect.promise(() => view().unmount())),
				Effect.andThen(Effect.promise(() => reopenAnswerDraft(engine, preview, prompts))),
				Effect.tap((reopened) => Effect.sync(() => trackScreen(engine, reopened, tell))),
				Effect.andThen(settle()),
			),
		seedRepeatedRecovery: (copies: number, older: string) =>
			read(`an older Board version stored ${copies} copies of the current answers for recovery after ${JSON.stringify(older)}`, () => {
				const key = storedDraftKey();
				const record = storedRecord(key);
				const values = record?.values;
				if (!Predicate.isObject(values)) {
					throw new Error("The browser stores no draft to seed");
				}
				const answers = [...document.querySelectorAll<HTMLTextAreaElement>("[data-prompt] textarea")].map((box) => ({
					prompt: box.closest<HTMLElement>("[data-prompt]")?.dataset.prompt,
					selected: [],
					text: box.value,
				}));
				const block = `Earlier template answers (selections cleared; review before choosing again):\n${JSON.stringify(answers, null, 2)}\n`;
				values.recovery = `${block.repeat(copies)}${older}`;
				localStorage.setItem(key, JSON.stringify(record));
			}),
		storedDraft: (item: string, request: string) =>
			read(
				`the reader checks the browser's stored draft for ${item}/${request}`,
				() => localStorage.getItem(formDraft(() => 0, "response", item, request).key) ?? "nothing stored",
			),
		storedEarlierAnswers: () =>
			read("the reader reads the earlier answers the browser stores with the draft", () => {
				const values = storedRecord(storedDraftKey())?.values;
				return earlierAnswers(Predicate.isObject(values) ? values.recovery : undefined);
			}),
	};
}
