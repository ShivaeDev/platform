import { Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";
import { setNativeValue } from "./setNativeValue.ts";

function form() {
	const found = document.querySelector<HTMLFormElement>("#handoff-form");
	if (!found) {
		throw new Error("The page shows no handoff form");
	}
	return found;
}

function field(label: string) {
	const labels = [...form().querySelectorAll<HTMLLabelElement>("label")];
	const found = labels.find((candidate) => candidate.textContent === label);
	const control = found ? document.getElementById(found.htmlFor) : null;
	if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) {
		throw new Error(`The handoff form has no field labelled ${label}; it has ${JSON.stringify(labels.map((candidate) => candidate.textContent))}`);
	}
	return control;
}

function button(name: string, within: ParentNode = form()) {
	const found = [...within.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent === name);
	if (!found) {
		throw new Error(`The handoff form has no ${name} button`);
	}
	return found;
}

function prompt() {
	return document.querySelector<HTMLTextAreaElement>("#handoff-prepared textarea");
}

export function handoffFormVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { accessible } = screenDriver({ root: () => document.body, tell: () => undefined });
	function settle() {
		return screenSettles(engine, tell);
	}
	// The prepared prompt takes focus in an effect after the save renders.
	function nextFrame() {
		return Effect.sync(() => tell("the browser draws the next frame")).pipe(
			Effect.andThen(Effect.promise(() => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))))),
			Effect.andThen(settle()),
		);
	}
	function perform(line: string, action: () => void) {
		return Effect.sync(() => tell(line)).pipe(
			Effect.andThen(Effect.promise(() => act(async () => action()))),
			Effect.andThen(settle()),
			Effect.andThen(nextFrame()),
		);
	}
	function read<T>(line: string, value: () => T) {
		return Effect.sync(() => {
			tell(line);
			return value();
		});
	}
	return {
		clearHandoffDraft: () => perform("the reader clears the handoff draft", () => button("Clear draft").click()),
		copyHandoffPrompt: () => perform("the reader presses Copy prompt", () => button("Copy prompt", document).click()),
		fillHandoff: (label: string, text: string) =>
			perform(
				`the reader writes ${JSON.stringify(text.length > 40 ? `${text.slice(0, 20)}… (${text.length} characters)` : text)} in ${label}`,
				() => {
					const control = field(label);
					setNativeValue(control, text);
					control.dispatchEvent(new Event("input", { bubbles: true }));
				},
			),
		focusPrepareHandoff: () => perform("the reader moves focus to Prepare handoff", () => button("Prepare handoff").focus()),
		handoffButtons: () =>
			read("the reader reads the handoff form's buttons", () =>
				[...form().querySelectorAll<HTMLButtonElement>("button")].map(
					(control) => `${accessible(control).name}${control.disabled ? " (disabled)" : ""}`,
				),
			),
		handoffContext: () =>
			read("the reader reads the item context above the handoff form", () => document.querySelector(".response-context")?.textContent ?? "none"),
		handoffField: (label: string) =>
			read(`the reader looks at ${label}`, () => {
				const control = field(label);
				return {
					focused: document.activeElement === control,
					placeholder: control.placeholder,
					problem: control.validationMessage,
					selection: [control.selectionStart, control.selectionEnd],
					text: control.value,
				};
			}),
		handoffFields: () =>
			read("the reader reads the handoff form's fields", () =>
				[...form().querySelectorAll<HTMLLabelElement>("label")].map((label) => `${label.textContent}: ${field(label.textContent ?? "").value}`),
			),
		handoffNotice: () =>
			read("the reader reads the notice above the handoff form", () => document.querySelector("main [role='alert']")?.textContent ?? "none"),
		handoffPageHeader: () =>
			read("the reader reads the handoff page's title and actions", () => ({
				actions: [...document.querySelectorAll<HTMLElement>("[data-page-actions] :is(a, button)")].map((control) => ({
					...accessible(control),
					href: control.getAttribute("href") ?? "none",
				})),
				title: document.querySelector("#doc [data-page-header] > h1")?.textContent ?? "none",
			})),
		handoffStatus: () => read("the reader reads the handoff status line", () => document.querySelector("#handoff-status")?.textContent ?? "none"),
		handoffStatusLines: () =>
			read("the reader counts the status lines inside the handoff form", () =>
				[...form().querySelectorAll("[role='status']")].map((status) => status.id || status.textContent),
			),
		handoffsSoFar: () =>
			read("the reader reads the handoffs prepared so far", () => {
				const history = document.querySelector("#handoff-history");
				const articles = [...(history?.querySelectorAll("article") ?? [])];
				return articles.length === 0
					? (history?.querySelector('[data-slot="empty-title"]')?.textContent ?? "none")
					: articles.map((article) => article.querySelector("header")?.textContent ?? "");
			}),
		preparedPrompt: () =>
			read("the reader looks at the prepared prompt", () => {
				const box = prompt();
				if (!box) {
					return "none";
				}
				return {
					focused: document.activeElement === box,
					selected: box.selectionStart === 0 && box.selectionEnd === box.value.length ? "all" : "part",
					text: box.value,
				};
			}),
		pressPrepareHandoff: () => perform("the reader presses Prepare handoff", () => button("Prepare handoff").click()),
		previewHandoff: () => perform("the reader previews the handoff file", () => button("Preview file").click()),
		selectInHandoff: (label: string, start: number, end: number) =>
			perform(`the reader selects characters ${start} to ${end} of ${label} backwards`, () => {
				const control = field(label);
				control.focus();
				control.setSelectionRange(start, end, "backward");
			}),
	};
}
