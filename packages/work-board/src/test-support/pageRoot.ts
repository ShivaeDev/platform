import type { BrowserWindow } from "happy-dom";

export function pageRoot(window: BrowserWindow) {
	function element(value: unknown): value is HTMLElement {
		return value instanceof window.HTMLElement;
	}
	const root = window.document.body;
	if (!element(root)) {
		throw new Error("The bundle page has no HTML body");
	}
	return root;
}
