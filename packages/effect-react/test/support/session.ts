import { RegistryContext } from "@effect/atom-react";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement, useContext } from "react";
import { createRoot } from "react-dom/client";
import { SessionBoundary } from "../../src/index.ts";
import { makeOrderEditor } from "../order-example/frontend.tsx";

interface Session {
	readonly id: string;
	readonly token: string;
}

export const shell = (url: string) => {
	window.location.href = url;
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const registries: AtomRegistry.AtomRegistry[] = [];
	const rechecks: string[] = [];
	const Registry = () => {
		const registry = useContext(RegistryContext);
		if (!registries.includes(registry)) registries.push(registry);
		return null;
	};
	const show = (session: Session | undefined, id: number) =>
		act(async () => {
			root.render(
				createElement(SessionBoundary<Session, ReturnType<typeof makeOrderEditor>>, {
					session,
					identify: (current) => current.id,
					connect: (current) => makeOrderEditor({ url, token: current.token }),
					recheck: () => rechecks.push(session?.id ?? "none"),
					signedOut: createElement("p", null, "Signed out"),
					children: ({ Editor }) => [createElement(Registry, { key: "registry" }), createElement(Editor, { key: "editor", id })],
				}),
			);
		});
	const input = () => container.querySelector<HTMLInputElement>('input[name="name"]');
	return {
		container,
		registries,
		rechecks,
		show,
		input,
		edit: (value: string) =>
			act(async () => {
				const field = input();
				if (!field) throw new Error("Missing name input");
				Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, value);
				field.dispatchEvent(new Event("input", { bubbles: true }));
			}),
		refresh: () => act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Refresh")?.click()),
		close: async () => {
			await act(async () => root.unmount());
			container.remove();
		},
	};
};

export const sessions = () =>
	new Map([
		["alice-token", { userId: "alice", expiresAt: Number.POSITIVE_INFINITY }],
		["bob-token", { userId: "bob", expiresAt: Number.POSITIVE_INFINITY }],
	]);
