import { isRendered, targetName } from "#internal/screenAccessibility.ts";
import { screenText } from "#internal/screenText.ts";
import type { ScreenTarget } from "#screenDriver.ts";
import { screenQueries } from "./screenQueries.ts";

export function screenElements(root: () => HTMLElement, dialogs = true) {
	const queries = screenQueries(root, dialogs);
	function rendered(found: HTMLElement, selector: string) {
		if (!isRendered(found)) {
			throw new Error(`The screen's ${selector} is not rendered.\nhelp: Reveal the target and its ancestors before acting on or reading it.`);
		}
		return found;
	}
	function element(selector: ScreenTarget) {
		if (typeof selector !== "string") {
			return queries.roleElement(selector);
		}
		const matches = queries.query(selector);
		const found = matches[0];
		if (matches.length !== 1 || found === undefined) {
			throw new Error(
				`The screen has ${matches.length} matches for ${JSON.stringify(selector)}.\nhelp: Use a selector for exactly one rendered control or readout.`,
			);
		}
		return rendered(found, selector);
	}
	function input(selector: ScreenTarget) {
		const found = element(selector);
		if (!(found instanceof HTMLInputElement || found instanceof HTMLTextAreaElement)) {
			throw new Error(
				`The screen's ${targetName(selector)} is not a text field.\nhelp: Select a rendered input or textarea to enter or read a value.`,
			);
		}
		return found;
	}
	function enabled(found: HTMLElement, selector: ScreenTarget) {
		if (found.matches(":disabled") || found.closest("[inert]")) {
			throw new Error(`The screen's ${targetName(selector)} is disabled.\nhelp: Wait for the app to enable the control before acting on it.`);
		}
	}
	return {
		element,
		enabled,
		enter: (selector: ScreenTarget, value: string) => {
			const field = input(selector);
			enabled(field, selector);
			if (field.readOnly) {
				throw new Error(`The screen's ${targetName(selector)} is read-only.\nhelp: Select an editable input or textarea.`);
			}
			field.focus();
			const prototype = field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
			Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value);
			field.dispatchEvent(new Event("input", { bubbles: true }));
			field.dispatchEvent(new Event("change", { bubbles: true }));
		},
		form: (selector: ScreenTarget) => {
			const found = element(selector);
			if (!(found instanceof HTMLFormElement)) {
				throw new Error(`The screen's ${targetName(selector)} is not a form.\nhelp: Select a rendered form to submit.`);
			}
			enabled(found, selector);
			return found;
		},
		input,
		matches: queries.matches,
		rendered,
		select: (selector: ScreenTarget, value: string) => {
			const field = element(selector);
			if (!(field instanceof HTMLSelectElement)) {
				throw new Error(`The screen's ${targetName(selector)} is not a select.\nhelp: Select a rendered select control.`);
			}
			enabled(field, selector);
			if (!Array.from(field.options).some((option) => option.value === value)) {
				throw new Error(`The screen's ${targetName(selector)} has no option ${JSON.stringify(value)}.\nhelp: Choose an available option value.`);
			}
			field.focus();
			field.value = value;
			field.dispatchEvent(new Event("change", { bubbles: true }));
		},
		text: screenText,
		textElement: queries.textElement,
	};
}
