import { act } from "react";
import type { Document } from "#browser/document/schema.ts";
import { control } from "./chrome.ts";
import type { ScreenEngine } from "./screenEngine.ts";

export function screenInteractions(engine: ScreenEngine, tell: (line: string) => void) {
	function target(value: string | HTMLElement | null | undefined) {
		const element = typeof value === "string" ? control(value, HTMLElement) : value;
		if (!element) {
			throw new Error(`Missing screen control ${value}`);
		}
		return element;
	}
	return {
		check: (option: string) => {
			tell(`the reader checks option ${option}`);
			const choice = target(`[data-choice="${option}"]`);
			act(() => choice.click());
		},
		focus: (selector: string | HTMLElement | null | undefined) => {
			tell(`the reader focuses ${selector}`);
			act(() => target(selector).focus());
		},
		openDetails: (selector: string | Element | null | undefined) => {
			tell(`the reader opens ${selector}`);
			const details = typeof selector === "string" ? control(selector, HTMLDetailsElement) : selector;
			if (!(details instanceof HTMLDetailsElement)) {
				throw new Error(`Missing details ${selector}`);
			}
			act(() => {
				details.open = true;
				details.dispatchEvent(new Event("toggle"));
			});
		},
		pauseUpdates: async (paused: boolean) => {
			tell(`the reader ${paused ? "pauses" : "resumes"} live updates`);
			if (!(engine.view && engine.updatesPaused)) {
				throw new Error("The screen has no updates control");
			}
			const { view, updatesPaused } = engine;
			await act(() => view.registry.set(updatesPaused, paused));
		},
		readDraftRecoveries: () => {
			tell("the reader reads each recovered answer packet");
			return (document.getElementById("response-draft-recovery")?.textContent ?? "")
				.split(/(?=Earlier template answers)/u)
				.map((entry) => entry.trim())
				.filter(Boolean);
		},
		readDraftRecovery: () => {
			tell("the reader reads draft recovery guidance");
			return document.getElementById("response-draft-recovery")?.textContent ?? "";
		},
		readInnerScrollers: (selector: string) => {
			tell(`the reader checks for height-bounded scrollers inside ${selector}`);
			return [...target(selector).querySelectorAll<HTMLElement>("*")].filter((element) => {
				const classes = [...element.classList];
				return classes.some((name) => /max-h-|(?:^|:)h-\[/u.test(name)) && classes.some((name) => /overflow(?:-y)?-(?:auto|scroll)/u.test(name));
			});
		},
		refreshDocumentSource: async (document: Document) => {
			tell("the reader receives refreshed document source");
			if (!engine.documentView) {
				throw new Error("No document is open");
			}
			await engine.documentView.render(document);
		},
		selectText: (selector: string | HTMLElement, start: number, end: number, direction: "forward" | "backward" | "none" = "none") => {
			tell(`the reader selects characters ${start} to ${end}`);
			const field = target(selector);
			if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
				throw new Error(`Missing text field ${selector}`);
			}
			act(() => {
				const details = field.closest("details");
				if (details) {
					details.open = true;
				}
				field.focus();
				field.setSelectionRange(start, end, direction);
			});
		},
		setMediaMatch: (query: string, matches: boolean) => {
			tell(`the browser ${matches ? "matches" : "stops matching"} ${query}`);
			const media = engine.media?.get(query);
			if (!media) {
				throw new Error(`No media query ${query} is mounted`);
			}
			act(() => {
				Object.defineProperty(media, "matches", { configurable: true, value: matches });
				media.dispatchEvent(new Event("change"));
			});
		},
		stored: (key: string) => {
			tell(`the reader checks stored ${key}`);
			return localStorage.getItem(key);
		},
	};
}
