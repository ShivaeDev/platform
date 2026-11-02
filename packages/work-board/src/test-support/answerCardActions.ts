import { Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { answerBox, answerCardReads, openDetails, required } from "./answerCardReads.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { setNativeValue } from "./setNativeValue.ts";

export function answerCardActions(engine: ScreenEngine, tell: (line: string) => void) {
	const driver = screenDriver({ act, root: () => document.documentElement, tell });
	const { settle, perform, read, nextFrame, choice } = answerCardReads(engine, tell);
	return {
		changeAnswer: () =>
			read("the reader looks at Change answer", () => {
				const change = document.querySelector<HTMLDetailsElement>("details[data-key='change-answer']");
				if (!change) {
					return "missing";
				}
				return {
					chosen: [...change.querySelectorAll<HTMLElement>("[data-choice][aria-checked='true']")].map((element) => element.dataset.choice),
					replaces: change.querySelector<HTMLInputElement>("[name='supersedes']")?.value,
					state: change.open ? "open" : "closed",
				};
			}),
		chooseAnswer: (option: string) =>
			perform(`the reader chooses ${option}`, () => {
				required(choice(option).closest(".question-choice")?.querySelector("label"), `label for ${option}`).click();
			}),
		chooseInMoreOptions: (label: string, option: string) =>
			Effect.gen(function* () {
				tell(`the reader chooses ${JSON.stringify(option)} for ${label} under More options`);
				yield* Effect.promise(() => act(async () => openDetails("details[data-key='response-details']")));
				yield* settle();
				const combobox = required(
					[...document.querySelectorAll<HTMLElement>("#response-form [role='combobox']")].find(
						(candidate) => document.querySelector(`label[for="${CSS.escape(candidate.id)}"]`)?.textContent === label,
					),
					`${label} choice`,
				);
				yield* Effect.promise(() => act(async () => combobox.click()));
				const listbox = CSS.escape(combobox.getAttribute("aria-controls") ?? "");
				const picked = required(
					[...document.querySelectorAll<HTMLElement>(`#${listbox} [role="option"]`)].find((candidate) => candidate.textContent === option),
					`${option} in ${label}`,
				);
				yield* Effect.promise(() => act(async () => picked.click()));
				yield* settle();
			}),
		clearAnswerDraft: () =>
			perform("the reader clears the answer draft", () => required(document.querySelector<HTMLElement>("#response-clear"), "Clear draft").click()),
		focusAnswerBox: (prompt?: string) =>
			driver.focus(prompt === undefined ? "#response-form [name='body']" : `[data-prompt="${prompt}"] textarea`).pipe(Effect.andThen(settle())),
		focusOption: (option: string) => driver.focus(`[data-choice="${option}"]`).pipe(Effect.andThen(settle())),
		followAnswerLink: (href: string) =>
			Effect.gen(function* () {
				tell(`the reader follows ${href}`);
				yield* Effect.promise(() =>
					act(() => {
						const link = document.createElement("a");
						link.href = href;
						document.body.append(link);
						link.click();
						link.remove();
						return Promise.resolve();
					}),
				);
				yield* settle();
				yield* nextFrame();
			}),
		openChangeAnswer: () => perform("the reader opens Change answer", () => openDetails("details[data-key='change-answer']")),
		openMoreOptions: () => perform("the reader opens More options", () => openDetails("details[data-key='response-details']")),
		pressKey: (key: string) => driver.pressKey(":focus", key).pipe(Effect.andThen(settle())),
		previewAnswer: () =>
			perform("the reader previews the answer file", () =>
				required(document.querySelector<HTMLElement>("#response-preview"), "Preview Markdown").click(),
			),
		recordAnswer: () =>
			perform("the reader records the answer", () =>
				required(document.querySelector<HTMLElement>("#response-form button[type='submit']"), "Record answer button").click(),
			),
		selectInAnswer: (start: number, end: number, prompt?: string) =>
			perform(`the reader selects characters ${start} to ${end} of the ${prompt ?? "answer"} box`, () => {
				const box = answerBox(prompt);
				box.focus();
				box.setSelectionRange(start, end, "backward");
			}),
		writeAnswer: (text: string, prompt?: string) =>
			perform(`the reader writes ${JSON.stringify(text)} in the ${prompt ?? "answer"} box`, () => {
				const box = answerBox(prompt);
				setNativeValue(box, text);
				box.dispatchEvent(new Event("input", { bubbles: true }));
			}),
	};
}
