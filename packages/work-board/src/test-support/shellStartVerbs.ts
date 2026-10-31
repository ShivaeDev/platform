import { Effect } from "effect";
import type { ScreenEngine } from "./screenEngine.ts";
import { shellActs, shellElement } from "./shellScreenAct.ts";

function card(file: string) {
	return shellElement(`.start-template:has([data-template-copy="${file}"])`, `template card for ${file}`);
}

export function shellStartVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { acting, reading } = shellActs(engine, tell);
	return {
		copiedText: () =>
			Effect.promise(() => {
				tell("the reader pastes what the clipboard holds");
				return navigator.clipboard.readText();
			}),
		copyTemplate: (file: string) =>
			acting(`the reader clicks Copy on the ${file} template`, () =>
				shellElement(`[data-template-copy="${file}"]`, `Copy button for ${file}`).click(),
			),
		startSteps: () =>
			reading("the reader reads the Start page's steps", () => [...document.querySelectorAll("main ol li")].map((step) => step.textContent)),
		templateCard: (file: string) =>
			reading(`the reader reads the ${file} template card`, () => {
				const found = card(file);
				return {
					source: found.querySelector("details")?.open ? "open" : "closed",
					status: found.querySelector("[data-copy-status]")?.textContent,
				};
			}),
		templateCards: () =>
			reading("the reader reads the Start page's template cards", () =>
				[...document.querySelectorAll(".start-template")].map((found) => ({
					saveAs: found.querySelector("[data-slot='card-description']")?.textContent,
					title: found.querySelector("h2")?.textContent,
				})),
			),
		templateSource: (file: string) =>
			reading(`the reader reads the ${file} template's source`, () => card(file).querySelector("textarea")?.value ?? "no source"),
	};
}
