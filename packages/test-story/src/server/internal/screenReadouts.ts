import { screenElements } from "#server/adapters/screenElements.ts";
import type { ScreenTarget } from "#server/screenDriver.ts";
import { accessibility, isRendered, targetName } from "./screenAccessibility.ts";

export function screenReadouts(currentRoot: () => HTMLElement, tell: (line: string) => void, dialogs = true) {
	const elements = screenElements(currentRoot, dialogs);
	return {
		accessible: (selector: string | Element) => {
			if (typeof selector !== "string") {
				return accessibility(selector);
			}
			const element = elements.element(selector);
			const accessible = accessibility(element);
			tell(`read the accessibility of ${selector}: ${JSON.stringify(accessible)}`);
			return accessible;
		},
		labelledText: (label: string | RegExp) => {
			const text = elements.text(elements.labelled(label));
			tell(`read the text labelled ${String(label)}: ${JSON.stringify(text)}`);
			return text;
		},
		selection: (selector: ScreenTarget) => {
			const field = elements.selectField(selector);
			const selection = {
				options: [...field.options].map((option) => ({
					label: option.getAttribute("label") || (option.textContent ?? "").replace(/\s+/gu, " ").trim(),
					value: option.value,
				})),
				value: field.value,
			};
			tell(`read the selection in ${targetName(selector)}: ${JSON.stringify(selection)}`);
			return selection;
		},
		table: (label: string | RegExp) => {
			const target = { name: label, role: "table" };
			const table = elements.table(target);
			const rows = [...table.rows].filter(isRendered).map((row) => [...row.cells].filter(isRendered).map(elements.text));
			tell(`read ${targetName(target)}: ${JSON.stringify(rows)}`);
			return rows;
		},
		text: (selector?: ScreenTarget) => {
			const text = elements.text(selector === undefined ? elements.rendered(currentRoot(), "root") : elements.element(selector));
			tell(`read ${selector === undefined ? "the screen" : targetName(selector)}: ${JSON.stringify(text)}`);
			return text;
		},
		value: (selector: ScreenTarget) => {
			const value = elements.input(selector).value;
			tell(`read the value in ${targetName(selector)}: ${JSON.stringify(value)}`);
			return value;
		},
	};
}
