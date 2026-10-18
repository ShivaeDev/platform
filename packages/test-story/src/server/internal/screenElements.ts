export function screenElements(root: HTMLElement) {
	function element(selector: string) {
		const matches = root.querySelectorAll<HTMLElement>(selector);
		const found = matches[0];
		if (matches.length !== 1 || found === undefined) {
			throw new Error(
				`The screen has ${matches.length} matches for ${JSON.stringify(selector)}.\nhelp: Use a selector for exactly one rendered control or readout.`,
			);
		}
		return found;
	}
	function input(selector: string) {
		const found = element(selector);
		if (!(found instanceof HTMLInputElement || found instanceof HTMLTextAreaElement)) {
			throw new Error(`The screen's ${selector} is not a text field.\nhelp: Select a rendered input or textarea to enter or read a value.`);
		}
		return found;
	}
	function enabled(found: HTMLElement, selector: string) {
		if (found.matches(":disabled") || found.closest("[inert]")) {
			throw new Error(`The screen's ${selector} is disabled.\nhelp: Wait for the app to enable the control before acting on it.`);
		}
	}
	return {
		element,
		enabled,
		enter: (selector: string, value: string) => {
			const field = input(selector);
			enabled(field, selector);
			if (field.readOnly) {
				throw new Error(`The screen's ${selector} is read-only.\nhelp: Select an editable input or textarea.`);
			}
			field.focus();
			const prototype = field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
			Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value);
			field.dispatchEvent(new Event("input", { bubbles: true }));
			field.dispatchEvent(new Event("change", { bubbles: true }));
		},
		form: (selector: string) => {
			const found = element(selector);
			if (!(found instanceof HTMLFormElement)) {
				throw new Error(`The screen's ${selector} is not a form.\nhelp: Select a rendered form to submit.`);
			}
			return found;
		},
		input,
	};
}
