import { Effect } from "effect";
import { act } from "react";
import { vi } from "vitest";
import type { ReadingState } from "#client/react/readingState.ts";
import { motionActions } from "./motionActions.ts";
import { readingActions } from "./readingActions.ts";
import { readingSettles } from "./readingSettle.ts";
import { availabilityActions } from "./screenAvailability.tsx";
import { screenData } from "./screenData.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { shellSearchVerbs } from "./shellSearchVerbs.ts";

export const clipboards = new WeakMap<ScreenEngine, string[]>();

export const statusRegions = new WeakMap<ScreenEngine, Element>();

export const rememberedReadings = new WeakMap<ScreenEngine, ReadingState>();

export const firstShells = new WeakMap<ScreenEngine, Element>();

export function recordClipboard(engine: ScreenEngine) {
	const written: string[] = [];
	clipboards.set(engine, written);
	vi.spyOn(navigator.clipboard, "writeText").mockImplementation((copied) => {
		written.push(copied);
		return Promise.resolve();
	});
}

export function all(selector: string, within: ParentNode = document) {
	return [...within.querySelectorAll<HTMLElement>(selector)];
}

export function text(element: Node | null | undefined) {
	return element?.textContent?.trim() ?? "";
}

export function linkPair(link: Element) {
	return [text(link), link.getAttribute("href")];
}

export function place(element: Element) {
	const panel = element.closest('[role="tabpanel"]');
	if (panel) {
		return `the ${text(document.getElementById(panel.getAttribute("aria-labelledby") ?? ""))} tab of the item context`;
	}
	if (element.closest(".item-context")) {
		return "the item context";
	}
	return element.closest(".document-criteria") ? "the main column after the body" : "the main column";
}

export function summaryFields() {
	return all(".item-summary > p").find((field) => /^(?:Owner|Next action):/u.test(text(field)));
}

export function copyButton() {
	return document.querySelector<HTMLButtonElement>('.item-summary button[aria-label*="item ID"], .item-summary button[aria-label^="Copy failed"]');
}

export function outlineTrigger() {
	return document.querySelector<HTMLElement>("[data-outline-menu]");
}

export function outlinePopover() {
	return document.querySelector<HTMLElement>('[data-slot="popover-content"][aria-label="On this page"]');
}

export function readingScreenReads(engine: ScreenEngine, tell: (line: string) => void) {
	const data = screenData(engine, tell);
	const reading = readingActions(tell);
	const search = shellSearchVerbs(engine, tell);
	const motion = motionActions(engine, tell);
	const availability = availabilityActions(engine, tell);
	function remembered() {
		const kept = rememberedReadings.get(engine);
		if (!kept) {
			throw new Error("The story remembered no reading");
		}
		return kept;
	}
	function read<T>(line: string, value: () => T) {
		return Effect.sync(() => {
			tell(line);
			return value();
		});
	}
	function perform(line: string, target: () => HTMLElement | null | undefined, missing: string, action: (element: HTMLElement) => void) {
		return Effect.gen(function* () {
			tell(line);
			const element = target();
			if (!element) {
				return yield* Effect.die(new Error(missing));
			}
			yield* Effect.promise(() => act(async () => action(element)));
			yield* readingSettles(engine, tell);
		});
	}
	return { availability, data, motion, perform, read, reading, remembered, search };
}
