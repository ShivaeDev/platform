import { accessibleName } from "./accessibleRole.ts";
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
		toggle: (group: string, option: string) => {
			tell(`the reader chooses ${option} in ${group}`);
			const button = [...page().document.querySelectorAll('[role="group"]')]
				.filter((found) => accessibleName(found) === group)
				.flatMap((found) => [...found.querySelectorAll("button")])
				.find((found) => accessibleName(found) === option);
			if (!button) {
				throw new Error(`Missing ${option} in ${group}`);
			}
			button.dispatchEvent(new (page().window.MouseEvent)("click", { bubbles: true, button: 0, cancelable: true }));
		},
		clickSelector: (selector: string) => {
			tell(`the reader clicks ${selector}`);
			element(selector).dispatchEvent(new (page().window.MouseEvent)("click", { bubbles: true, button: 0, cancelable: true }));
		},
		keyboard: (key: string, ctrlKey = false, selector?: string) => {
			tell(`the reader presses ${ctrlKey ? "Ctrl+" : ""}${key}`);
			(selector ? element(selector) : element('#search-dialog [role="combobox"]')).dispatchEvent(
				new (page().window.KeyboardEvent)("keydown", { bubbles: true, cancelable: true, ctrlKey, key }),
			);
		},
	};
}
