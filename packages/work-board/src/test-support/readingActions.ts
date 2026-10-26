import { act } from "react";
import { vi } from "vitest";
import { control } from "./chrome.ts";
import type { ScreenEngine } from "./screenEngine.ts";

export function readingActions(engine: ScreenEngine, tell: (line: string) => void) {
	return {
		readHeaderFootprints: () => {
			tell("the reader checks the item header row at each layout measurement");
			void control("[data-page-header]", HTMLElement).offsetHeight;
			return engine.headerFootprints;
		},
		readTextSelection: (selector: string) => {
			tell(`the reader checks the caret in ${selector}`);
			const field = control(selector, HTMLTextAreaElement);
			return [field.selectionStart, field.selectionEnd, field.selectionDirection];
		},
		scrollDocument: (offset: number) => {
			tell(`the reader scrolls the document ${offset} pixels past its top`);
			const layout = control(".document-layout", HTMLElement);
			vi.spyOn(layout, "getBoundingClientRect").mockReturnValue(new DOMRect(0, -offset, layout.clientWidth, layout.clientHeight));
			act(() => {
				window.scrollTo(0, offset);
				window.dispatchEvent(new Event("scroll"));
			});
		},
		selectPassage: (selector: string, start: number, end: number) => {
			tell(`the reader selects characters ${start} to ${end} in ${selector}`);
			const passage = control(selector, HTMLElement).firstChild;
			const selection = document.getSelection();
			if (!(passage && selection)) {
				throw new Error(`Missing selectable passage ${selector}`);
			}
			act(() => selection.setBaseAndExtent(passage, start, passage, end));
		},
	};
}
