import { Effect } from "effect";
import { act } from "react";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";

export const CARD = ".answer-cards .response-panel, .response-panel";

export const PARTS = [
	["title", "h2"],
	["answered note", "[data-answered]"],
	["reason", ".answer-reason"],
	["recommendation", ".answer-recommendation"],
	["links", ".answer-links"],
	["options", ".question-choice"],
	["answer box", "textarea"],
	["Record answer", "button[type='submit']"],
	["More options", "details[data-key='response-details']"],
] as const;

export function card() {
	return document.querySelector<HTMLElement>(CARD);
}

export function required<T extends Element>(element: T | null | undefined, name: string): T {
	if (!element) {
		throw new Error(`The answer card has no ${name}`);
	}
	return element;
}

export function optionLabel(choice: Element) {
	const strong = choice.querySelector("strong");
	const badge = strong?.querySelector("[data-slot='badge']")?.textContent ?? "";
	return (strong?.textContent ?? "").slice(0, (strong?.textContent ?? "").length - badge.length);
}

export function describeOption(choice: Element) {
	const label = optionLabel(choice);
	const recommended = choice.querySelector("strong [data-slot='badge']") ? " (recommended)" : "";
	const description = choice.querySelector(`[id$="-description"]`)?.textContent;
	return `${label}${recommended}${description ? `: ${description}` : ""}`;
}

export function openDetails(selector: string) {
	const details = required(document.querySelector<HTMLDetailsElement>(selector), selector);
	details.open = true;
	details.dispatchEvent(new Event("toggle"));
}

export function answerBox(prompt?: string) {
	const selector = prompt === undefined ? "#response-form [name='body']" : `[data-prompt="${prompt}"] textarea`;
	return required(document.querySelector<HTMLTextAreaElement>(selector), prompt === undefined ? "answer box" : `answer box for ${prompt}`);
}

export function answerCardReads(engine: ScreenEngine, tell: (line: string) => void) {
	const { accessible } = screenDriver({ root: () => document.body, tell: () => undefined });
	function settle() {
		return screenSettles(engine, tell);
	}
	function perform(line: string, action: () => void) {
		return Effect.sync(() => tell(line)).pipe(Effect.andThen(Effect.promise(() => act(async () => action()))), Effect.andThen(settle()));
	}
	function read<T>(line: string, value: () => T) {
		return Effect.sync(() => {
			tell(line);
			return value();
		});
	}
	// The page restores its reading position and answer focus in an animation frame after the route settles.
	function nextFrame() {
		return Effect.sync(() => tell("the browser draws the next frame, where the page places focus")).pipe(
			Effect.andThen(Effect.promise(() => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))))),
			Effect.andThen(settle()),
		);
	}
	function choice(option: string) {
		return required(document.querySelector<HTMLElement>(`[data-choice="${option}"]`), `option ${option}`);
	}
	return { accessible, choice, nextFrame, perform, read, settle };
}
