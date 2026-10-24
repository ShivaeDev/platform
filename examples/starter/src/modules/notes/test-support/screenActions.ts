import { Effect } from "effect";
import { act } from "react";
import { type ScreenSurface, screenView } from "#test-support/screenState.ts";

export function screenInput(engine: ScreenSurface, label?: string) {
	const container = screenView(engine).container;
	const field = label === undefined ? undefined : [...container.querySelectorAll("label")].find((element) => element.textContent === label);
	const input = label === undefined ? container.querySelector("input") : document.getElementById(field?.htmlFor ?? "");
	if (!(input instanceof HTMLInputElement)) {
		throw new Error(`Missing ${label ?? "title"} input`);
	}
	return input;
}

export function screenActions(engine: ScreenSurface, tell: (line: string) => void) {
	function followLink(label?: string) {
		return Effect.promise(async () => {
			tell(label === undefined ? "open the saved note from the list" : `follow ${label}`);
			const container = screenView(engine).container;
			const link =
				label === undefined
					? container.querySelector<HTMLAnchorElement>("tbody td a")
					: [...container.querySelectorAll("a")].find((element) => element.textContent === label);
			if (link === null || link === undefined) {
				throw new Error(`Missing ${label ?? "saved note"} link`);
			}
			await act(() => link.click());
		});
	}
	return {
		click: (label: string) =>
			Effect.promise(async () => {
				tell(`click ${label}`);
				const button = [...screenView(engine).container.querySelectorAll("button")].find((element) => element.textContent === label);
				if (button === undefined) {
					throw new Error(`Missing ${label} button`);
				}
				if (button.disabled) {
					throw new Error(`Cannot click disabled ${label} button`);
				}
				await act(async () => button.click());
			}),
		enter: (value: string, label?: string) =>
			Effect.promise(async () => {
				tell(`enter ${JSON.stringify(value)} in ${label ?? "the title"}`);
				const input = screenInput(engine, label);
				await act(() => {
					const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
					if (setValue === undefined) {
						throw new Error("Missing input value setter");
					}
					setValue.call(input, value);
					input.dispatchEvent(new Event("input", { bubbles: true }));
				});
			}),
		followLink,
		openListedNote: () => followLink(),
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
