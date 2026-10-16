import { act } from "react";

export function screenActions(tell: (line: string) => void) {
	return {
		enter: async (container: HTMLElement, value: string, label?: string) => {
			tell(`enter ${JSON.stringify(value)} in ${label ?? "the title"}`);
			const field = label === undefined ? undefined : [...container.querySelectorAll("label")].find((element) => element.textContent === label);
			const input = label === undefined ? container.querySelector("input") : document.getElementById(field?.htmlFor ?? "");
			if (!(input instanceof HTMLInputElement)) {
				throw new Error(`Missing ${label ?? "title"} input`);
			}
			await act(() => {
				Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
				input.dispatchEvent(new Event("input", { bubbles: true }));
			});
		},
		submit: async (container: HTMLElement) => {
			tell("submit the form");
			const form = container.querySelector("form");
			if (form === null) {
				throw new Error("Missing form");
			}
			await act(async () => {
				form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
				await Promise.resolve();
			});
		},
	};
}
