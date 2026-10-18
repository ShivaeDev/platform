import { act } from "react";
import { control } from "./chrome.ts";

export function readingActions(tell: (line: string) => void) {
	return {
		readTextSelection: (selector: string) => {
			tell(`the reader checks the caret in ${selector}`);
			const field = control(selector, HTMLTextAreaElement);
			return [field.selectionStart, field.selectionEnd, field.selectionDirection];
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
