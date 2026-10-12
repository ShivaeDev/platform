import { RegistryContext } from "@effect/atom-react";
import { Clock, Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, vi } from "vitest";
export function expectNoReactWarnings() {
	beforeEach(({ onTestFinished }) => {
		const errors = vi.spyOn(console, "error");
		onTestFinished(() => {
			const calls = errors.mock.calls;
			errors.mockRestore();
			expect(calls).toEqual([]);
		});
	});
}
export async function eventually(assert: () => void) {
	const deadline = Effect.runSync(Clock.currentTimeMillis) + 3000;
	while (true) {
		// Network responses must settle inside act, including the time between assertions.
		await act(async () => {
			await new Promise<void>((resolve) => setTimeout(resolve, 10));
		});
		try {
			assert();
			return;
		} catch (error) {
			if (Effect.runSync(Clock.currentTimeMillis) >= deadline) {
				throw error;
			}
		}
	}
}
export interface Rendered {
	readonly container: HTMLDivElement;
	readonly registry: AtomRegistry.AtomRegistry;
	readonly render: (node: ReactNode) => Promise<void>;
	readonly unmount: () => Promise<void>;
}
export async function render(node: ReactNode): Promise<Rendered> {
	const registry = AtomRegistry.make();
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	let mounted = true;
	async function unmount() {
		if (!mounted) {
			return;
		}
		mounted = false;
		try {
			await act(async () => root.unmount());
		} finally {
			registry.dispose();
			container.remove();
		}
	}
	async function update(next: ReactNode) {
		await act(async () => root.render(createElement(RegistryContext.Provider, { value: registry }, next)));
	}
	try {
		await update(node);
	} catch (error) {
		await unmount();
		throw error;
	}
	return { container, registry, render: update, unmount };
}
