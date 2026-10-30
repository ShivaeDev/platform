import { Effect } from "effect";
import { act, type ReactNode } from "react";
import type { RootOptions } from "react-dom/client";
import { beforeEach, vi } from "vitest";
import { eventually, expectNoReactWarnings, type Rendered, render } from "@shivaedev/test-story/client/react.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
export const screenWarnings = expectNoReactWarnings();
beforeEach(({ onTestFinished }) => {
	onTestFinished(() => {
		vi.useRealTimers();
	});
});

export function typeInput(container: HTMLElement, name: string, value: string) {
	const field = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
	if (!field) {
		throw new Error(`Missing ${name} input`);
	}
	Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, value);
	field.dispatchEvent(new Event("input", { bubbles: true }));
	field.dispatchEvent(new Event("change", { bubbles: true }));
}

export function clickButton(container: HTMLElement, label: string) {
	const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
	if (!button) {
		throw new Error(`Missing ${label} button`);
	}
	button.click();
}

export function submitForm(container: HTMLElement) {
	const form = container.querySelector("form");
	if (!form) {
		throw new Error("Missing form");
	}
	form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

export class Screen {
	readonly roots: Rendered[] = [];
	tell: (line: string) => void;
	constructor(tell: (line: string) => void) {
		this.tell = tell;
	}
	open(node: ReactNode = null, options?: RootOptions) {
		const roots = this.roots;
		return Effect.acquireRelease(
			Effect.promise(async () => {
				const view = await render(node, options);
				roots.push(view);
				return view;
			}),
			(view) => Effect.promise(view.unmount),
		);
	}
	act(line: string, run: () => unknown | Promise<unknown>) {
		this.tell(line);
		return Effect.promise(async () => {
			await act(async () => {
				await run();
			});
		});
	}
	observe(line: string, check: () => void) {
		this.tell(line);
		return eventually(check);
	}
	inspect() {
		return {
			screens: this.roots.map(({ container }) => ({
				connected: container.isConnected,
				html: container.innerHTML,
				inputs: [...container.querySelectorAll("input")].map(({ name, value }) => ({ name, value })),
			})),
		};
	}
}
