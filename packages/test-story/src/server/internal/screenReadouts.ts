import type { ScreenTarget } from "#screenDriver.ts";
import { accessibility, targetName } from "./screenAccessibility.ts";
import { screenElements } from "./screenElements.ts";

export function screenReadouts(currentRoot: () => HTMLElement, tell: (line: string) => void) {
	const elements = screenElements(currentRoot);
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
