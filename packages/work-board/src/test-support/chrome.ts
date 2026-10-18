import { act } from "react";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { renderRouter } from "./renderRouter.tsx";

export async function chrome(files: Record<string, string>, url = "/notes/plan.md") {
	const view = await renderRouter(files, url);
	await eventually(() => expect(view.container.querySelector("#doc")?.getAttribute("data-route")).toBe(url));
	const api = view.router.options.context?.shell?.api;
	if (!api) {
		throw new Error("Missing shell API");
	}
	return { ...view, api };
}
export function control<T extends HTMLElement>(selector: string, kind: { new (): T }): T {
	const element = document.querySelector(selector);
	if (!(element instanceof kind)) {
		throw new Error(`Missing ${selector}`);
	}
	return element;
}
export function click(selector: string) {
	act(() => control(selector, HTMLElement).click());
}
export function input(selector: string, value: string) {
	act(() => {
		const field = control(selector, HTMLInputElement);
		field.value = value;
		field.dispatchEvent(new Event("input", { bubbles: true }));
	});
}
export function choose(selector: string, value: string) {
	act(() => {
		const field = control(selector, HTMLSelectElement);
		field.value = value;
		field.dispatchEvent(new Event("change", { bubbles: true }));
	});
}
