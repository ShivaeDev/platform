import { act } from "react";
import { answerInput, answerPrompt, responseClick } from "./answerDraft.tsx";
import { control } from "./chrome.ts";

export function screenActions(tell: (line: string) => void) {
	function input(target: string | HTMLInputElement | HTMLTextAreaElement | null | undefined, value: string) {
		tell(`the reader types ${JSON.stringify(value)} in ${typeof target === "string" ? target : target?.name}`);
		const field = typeof target === "string" ? document.querySelector(target) : target;
		if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
			throw new Error(`Missing text field ${target}`);
		}
		act(() => {
			field.value = value;
			field.dispatchEvent(new Event("input", { bubbles: true }));
		});
		return field;
	}
	return {
		activate: async (selector: string) => {
			tell(`the reader activates ${selector}`);
			const element = control(selector, HTMLElement);
			await act(() => element.click());
		},
		answerInput: (name: string, value?: string) => {
			if (value !== undefined) {
				tell(`the reader answers ${name} with ${JSON.stringify(value)}`);
			}
			return answerInput(name, value);
		},
		answerPrompt: (name: string, value?: string) => {
			if (value !== undefined) {
				tell(`the reader answers prompt ${name} with ${JSON.stringify(value)}`);
			}
			return answerPrompt(name, value);
		},
		choose: (selector: string | HTMLSelectElement | null | undefined, value: string) => {
			tell(`the reader chooses ${JSON.stringify(value)} in ${selector}`);
			act(() => {
				const field = typeof selector === "string" ? control(selector, HTMLSelectElement) : selector;
				if (!(field instanceof HTMLSelectElement)) {
					throw new Error(`Missing select ${selector}`);
				}
				field.value = value;
				field.dispatchEvent(new Event("change", { bubbles: true }));
			});
		},
		click: (target: string | Element | null | undefined) => {
			tell(`the reader clicks ${typeof target === "string" ? target : target?.id || target?.textContent}`);
			const element = typeof target === "string" ? control(target, HTMLElement) : target;
			if (!(element instanceof HTMLElement)) {
				throw new Error(`Missing clickable control ${target}`);
			}
			act(() => element.click());
		},
		control,
		input,
		keyboard: (key: string, options: KeyboardEventInit = {}, target: EventTarget | string = document) => {
			tell(`the reader presses ${key}`);
			const event = new KeyboardEvent("keydown", { bubbles: true, ...options, key });
			act(() => (typeof target === "string" ? control(target, HTMLElement) : target).dispatchEvent(event));
			return event;
		},
		responseClick: (id: string) => {
			tell(`the reader clicks response ${id}`);
			responseClick(id);
		},
		submit: (selector: string) => {
			tell(`the reader submits ${selector}`);
			const form = control(selector, HTMLFormElement);
			act(() => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
		},
		typeText: input,
	};
}
