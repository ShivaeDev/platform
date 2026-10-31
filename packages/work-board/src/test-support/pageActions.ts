import type { OpenPage } from "./browser.ts";

export function pageActions(page: () => OpenPage, tell: (line: string) => void) {
	function element(selector: string) {
		const found = page().document.querySelector(selector);
		if (!(found instanceof page().window.HTMLElement)) {
			throw new Error(`Missing ${selector}`);
		}
		return found;
	}
	return {
		keyboard: (key: string, ctrlKey = false, selector?: string) => {
			tell(`the reader presses ${ctrlKey ? "Ctrl+" : ""}${key}`);
			(selector ? element(selector) : element('#search-dialog [role="combobox"]')).dispatchEvent(
				new (page().window.KeyboardEvent)("keydown", { bubbles: true, cancelable: true, ctrlKey, key }),
			);
		},
	};
}
