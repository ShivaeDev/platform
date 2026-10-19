import type { ReactNode } from "react";
import { act } from "react";
import type { Document } from "#browser/document/schema.ts";
import { formDraft } from "#client/formDraft.ts";
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
		browserEvent: (type: string, destination: "window" | "document" = "window") => {
			tell(`the browser emits ${type}`);
			act(() => (destination === "window" ? window : document).dispatchEvent(new Event(type)));
		},
		check: (option: string) => {
			tell(`the reader checks option ${option}`);
			const choice = target(`[data-choice="${option}"]`);
			act(() => choice.click());
		},
		closeScreen: async () => {
			tell("the reader closes the current screen");
			if (!engine.view) {
				throw new Error("The screen has not opened");
			}
			await engine.view.unmount();
		},
		draftKey: () => {
			tell("the reader checks the current draft's storage identity");
			const form = control("#response-form", HTMLFormElement);
			return formDraft("response", form.dataset.item ?? "", form.dataset.request).key;
		},
		focus: (selector: string | HTMLElement | null | undefined) => {
			tell(`the reader focuses ${selector}`);
			act(() => target(selector).focus());
		},
		frame: async (count = 1) => {
			tell("the browser completes a frame");
			for (let index = 0; index < count; index += 1) {
				await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
			}
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
		readDraftRecovery: () => {
			tell("the reader reads draft recovery guidance");
			return document.getElementById("response-draft-recovery")?.textContent ?? "";
		},
		readStoredDraft: () => {
			tell("the reader checks the current stored draft");
			const form = control("#response-form", HTMLFormElement);
			return localStorage.getItem(formDraft("response", form.dataset.item ?? "", form.dataset.request).key);
		},
		refreshDocumentSource: async (document: Document) => {
			tell("the reader receives refreshed document source");
			if (!engine.documentView) {
				throw new Error("No document is open");
			}
			await engine.documentView.render(document);
		},
		refreshScreen: async (node: ReactNode) => {
			tell("the reader receives refreshed screen data");
			if (!engine.view) {
				throw new Error("No screen is open");
			}
			await engine.view.render(node);
		},
		rememberStored: (key: string, value: string) => {
			tell(`an outside writer replaces stored ${key}`);
			localStorage.setItem(key, value);
		},
		scrollList: (selector: string | HTMLElement | null, top: number) => {
			tell(`the reader scrolls a list to ${top}`);
			const list = target(selector);
			act(() => {
				list.scrollTop = top;
				list.dispatchEvent(new Event("scroll", { bubbles: true }));
			});
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
