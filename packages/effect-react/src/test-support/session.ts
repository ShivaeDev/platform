import { RegistryContext } from "@effect/atom-react";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement, useContext } from "react";
import { createRoot } from "react-dom/client";
import { SessionBoundary } from "#session-boundary.ts";
import { makeOrderEditor } from "#test/order-example/frontend.tsx";

interface Session {
	readonly id: string;
	readonly token: string;
}

export function shell(url: string) {
	window.location.href = url;
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const registries: AtomRegistry.AtomRegistry[] = [];
	const rechecks: string[] = [];
	function Registry() {
		const registry = useContext(RegistryContext);
		if (!registries.includes(registry)) {
			registries.push(registry);
		}
		return null;
	}
	function show(session: Session | undefined, id: number) {
		return act(async () => {
			root.render(
				createElement(SessionBoundary<Session, ReturnType<typeof makeOrderEditor>>, {
					children: ({ Editor }) => [createElement(Registry, { key: "registry" }), createElement(Editor, { id, key: "editor" })],
					connect: (current) => makeOrderEditor({ token: current.token, url }),
					identify: (current) => current.id,
					recheck: () => rechecks.push(session?.id ?? "none"),
					session,
					signedOut: createElement("p", null, "Signed out"),
				}),
			);
		});
	}
	function input() {
		return container.querySelector<HTMLInputElement>('input[name="name"]');
	}
	return {
		close: async () => {
			await act(async () => root.unmount());
			container.remove();
		},
		container,
		edit: (value: string) =>
			act(async () => {
				const field = input();
				if (!field) {
					throw new Error("Missing name input");
				}
				Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, value);
				field.dispatchEvent(new Event("input", { bubbles: true }));
			}),
		input,
		rechecks,
		refresh: () => act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Refresh")?.click()),
		registries,
		show,
	};
}

export function sessions() {
	return new Map([
		["alice-token", { expiresAt: Number.POSITIVE_INFINITY, userId: "alice" }],
		["bob-token", { expiresAt: Number.POSITIVE_INFINITY, userId: "bob" }],
	]);
}
