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
		choose: (selector: string, value: string) => {
			tell(`the reader chooses ${value} in ${selector}`);
			const field = element(selector);
			if (!(field instanceof page().window.HTMLSelectElement)) {
				throw new Error(`Missing select ${selector}`);
			}
			field.value = value;
			field.dispatchEvent(new (page().window.Event)("change", { bubbles: true }));
		},
		clickSelector: (selector: string) => {
			tell(`the reader clicks ${selector}`);
			element(selector).dispatchEvent(new (page().window.MouseEvent)("click", { bubbles: true, button: 0, cancelable: true }));
		},
		keyboard: (key: string, ctrlKey = false, selector?: string) => {
			tell(`the reader presses ${ctrlKey ? "Ctrl+" : ""}${key}`);
			(selector ? element(selector) : (page().document.querySelector("#search-query") ?? page().document)).dispatchEvent(
				new (page().window.KeyboardEvent)("keydown", { bubbles: true, cancelable: true, ctrlKey, key }),
			);
		},
	};
}
