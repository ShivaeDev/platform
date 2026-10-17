import { Effect } from "effect";
import { act } from "react";
import { type Screen, screenView } from "./screenState.ts";

export function screenInput(engine: Screen, label?: string) {
	const container = screenView(engine).container;
	const field = label === undefined ? undefined : [...container.querySelectorAll("label")].find((element) => element.textContent === label);
	const input = label === undefined ? container.querySelector("input") : document.getElementById(field?.htmlFor ?? "");
	if (!(input instanceof HTMLInputElement)) {
		throw new Error(`Missing ${label ?? "title"} input`);
	}
	return input;
}

export function screenActions(engine: Screen, tell: (line: string) => void) {
	return {
		click: (label: string) =>
			Effect.promise(async () => {
				tell(`click ${label}`);
				const button = [...screenView(engine).container.querySelectorAll("button")].find((element) => element.textContent === label);
				if (button === undefined) {
					throw new Error(`Missing ${label} button`);
				}
				await act(async () => button.click());
			}),
		enter: (value: string, label?: string) =>
			Effect.promise(async () => {
				tell(`enter ${JSON.stringify(value)} in ${label ?? "the title"}`);
				const input = screenInput(engine, label);
				await act(() => {
					Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
					input.dispatchEvent(new Event("input", { bubbles: true }));
				});
			}),
		submit: () =>
			Effect.promise(async () => {
				tell("submit the form");
				const form = screenView(engine).container.querySelector("form");
				if (form === null) {
					throw new Error("Missing form");
				}
				await act(async () => {
					form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
					await Promise.resolve();
				});
			}),
	};
}
