import { act } from "react";
import { answerInput, answerPrompt, responseClick } from "./answerDraft.tsx";
import { control } from "./chrome.ts";
import { setNativeValue } from "./setNativeValue.ts";

export function screenActions(tell: (line: string) => void) {
	function input(target: string | HTMLInputElement | HTMLTextAreaElement | null | undefined, value: string) {
		tell(`the reader types ${JSON.stringify(value)} in ${typeof target === "string" ? target : target?.name}`);
		const field = typeof target === "string" ? document.querySelector(target) : target;
		if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
			throw new Error(`Missing text field ${target}`);
		}
		act(() => {
			setNativeValue(field, value);
			field.dispatchEvent(new Event("input", { bubbles: true }));
		});
		return field;
	}
	return {
		activate: async (selector: string) => {
			tell(`the reader activates ${selector}`);
			const element = control(selector, HTMLElement);
			await act(async () => element.click());
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
		chooseOption: async (trigger: string | Element | null | undefined, label: string) => {
			const combobox = typeof trigger === "string" ? document.querySelector(trigger) : trigger;
			if (!(combobox instanceof HTMLElement && combobox.getAttribute("role") === "combobox")) {
				throw new Error(`Missing select trigger ${trigger}`);
			}
			const name = document.querySelector(`label[for="${CSS.escape(combobox.id)}"]`)?.textContent ?? combobox.id;
			tell(`the reader chooses ${JSON.stringify(label)} in ${name}`);
			await act(() => combobox.click());
			const option = [...document.querySelectorAll<HTMLElement>(`#${CSS.escape(combobox.getAttribute("aria-controls") ?? "")} [role="option"]`)].find(
				(candidate) => candidate.textContent === label,
			);
			if (!option) {
				throw new Error(`Missing option ${label}`);
			}
			await act(() => option.click());
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
		hover: async (target: string | Element | null | undefined) => {
			tell(`the reader points at ${typeof target === "string" ? target : target?.textContent}`);
			const element = typeof target === "string" ? control(target, HTMLElement) : target;
			if (!(element instanceof HTMLElement)) {
				throw new Error(`Missing hover target ${target}`);
			}
			await act(async () => {
				for (const type of ["pointerover", "pointerenter", "mouseover", "mouseenter", "pointermove", "mousemove"]) {
					const init = { bubbles: !type.endsWith("enter"), pointerType: "mouse" };
					element.dispatchEvent(type.startsWith("pointer") ? new PointerEvent(type, init) : new MouseEvent(type, init));
				}
				await Promise.resolve();
			});
		},
		input,
		keyboard: (key: string, options: KeyboardEventInit = {}, target: EventTarget | string = document) => {
			tell(`the reader presses ${key}`);
			const event = new KeyboardEvent("keydown", { bubbles: true, ...options, key });
			act(() => (typeof target === "string" ? control(target, HTMLElement) : target).dispatchEvent(event));
			return event;
		},
		press: async (key: string) => {
			tell(`the reader presses and releases ${JSON.stringify(key)}`);
			for (const type of ["keydown", "keyup"]) {
				await act(() => {
					(document.activeElement ?? document).dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, key }));
					// Base UI moves focus between radios in a microtask; resolving keeps that move inside act.
					return Promise.resolve();
				});
			}
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
