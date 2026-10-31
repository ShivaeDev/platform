import { act } from "react";
import { vi } from "vitest";
import { control } from "./chrome.ts";

export function readingActions(tell: (line: string) => void) {
	return {
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
