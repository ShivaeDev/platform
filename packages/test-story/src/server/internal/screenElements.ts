import { isRendered, roleElement, targetName } from "#internal/screenAccessibility.ts";
import type { ScreenTarget } from "#screenDriver.ts";

export function screenElements(root: () => HTMLElement) {
	function rendered(found: HTMLElement, selector: string) {
		if (!isRendered(found)) {
			throw new Error(`The screen's ${selector} is not rendered.\nhelp: Reveal the target and its ancestors before acting on or reading it.`);
		}
		return found;
	}
	function element(selector: ScreenTarget) {
		if (typeof selector !== "string") {
			return roleElement(root(), selector);
		}
		const matches = root().querySelectorAll<HTMLElement>(selector);
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
	function text(found: HTMLElement): string {
		const walker = found.ownerDocument.createTreeWalker(found, NodeFilter.SHOW_TEXT);
		const parts: string[] = [];
		for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
			if (node.parentElement !== null && isRendered(node.parentElement)) {
				parts.push(node.textContent ?? "");
			}
		}
		return parts.join("");
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
		rendered,
		text,
	};
}
