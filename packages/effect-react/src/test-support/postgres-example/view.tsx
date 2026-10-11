import { RegistryContext } from "@effect/atom-react";
import { NodeHttpClient } from "@effect/platform-node";
import { Effect } from "effect";
import type * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect } from "vitest";
import type { AtomServices } from "#field-rejection.ts";
import { eventually } from "#testing.ts";
import { makeClient } from "./makeClient.ts";
import { OrderEditor } from "./OrderEditor.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

async function interact(action: () => void) {
	await act(async () => action());
}

export async function mountView(url: string, token = "alice-session") {
	window.location.href = url;
	const client = makeClient(url, token, NodeHttpClient.layerUndici);
	const registry = AtomRegistry.make();
	const releaseQuery = registry.mount(client.query);
	try {
		await Effect.runPromise(AtomRegistry.getResult(registry, client.query));
	} catch (error) {
		releaseQuery();
		registry.dispose();
		throw error;
	}
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	async function close() {
		await act(async () => root.unmount());
		releaseQuery();
		registry.dispose();
		container.remove();
	}
	try {
		await act(async () => root.render(createElement(RegistryContext.Provider, { value: registry }, createElement(OrderEditor, { client }))));
		await eventually(() => {
			expect(registry.get(client.status).connection).toBe("live");
			expect(registry.get(client.query).waiting).toBe(false);
		});
	} catch (error) {
		await close();
		throw error;
	}
	function input(name: string) {
		const found = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
		if (!found) {
			throw new Error(`Missing input ${name}`);
		}
		return found;
	}
	return {
		...client,
		click: (name: string) =>
			interact(() => {
				const button = [...container.querySelectorAll("button")].find((element) => element.textContent === name);
				if (!button) {
					throw new Error(`Missing button ${name}`);
				}
				button.click();
			}),
		close,
		container,
		edit: (name: string, value: string) =>
			interact(() => {
				const field = input(name);
				Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, value);
				field.dispatchEvent(new Event("input", { bubbles: true }));
			}),
		input,
		registry,
	};
}

export function call<A, E, R, TRuntimeError>(
	client: { readonly Client: { readonly runtime: Atom.AtomRuntime<R, TRuntimeError> } },
	effect: Effect.Effect<A, E, AtomServices<R>>,
) {
	const registry = AtomRegistry.make();
	return Effect.runPromise(AtomRegistry.getResult(registry, client.Client.runtime.atom(effect))).finally(() => registry.dispose());
}
