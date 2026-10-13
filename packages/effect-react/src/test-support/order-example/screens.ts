import { RegistryContext } from "@effect/atom-react";
import { NodeHttpClient } from "@effect/platform-node";
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect } from "vitest";
import { eventually } from "#testing.ts";
import { type Application, orderId } from "./applicationEngine.ts";
import { makeOrderEditor } from "./frontend.tsx";

export const activeScreens = new Set<HTMLDivElement>();

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

export function openScreen(engine: Application, alias: string, kind: "editor" | "list") {
	return Effect.acquireRelease(
		Effect.promise(async () => {
			window.location.href = engine.url;
			const views = makeOrderEditor({ httpClient: NodeHttpClient.layerNodeHttp, token: "alice-session", url: engine.url });
			const registry = AtomRegistry.make();
			const container = document.createElement("div");
			document.body.append(container);
			activeScreens.add(container);
			const root = createRoot(container);
			const child: ReactNode =
				kind === "editor"
					? createElement(views.Editor, { id: orderId(engine, alias) })
					: createElement(views.OrderList, { renameId: orderId(engine, alias) });
			async function close() {
				await act(async () => root.unmount());
				registry.dispose();
				container.remove();
				activeScreens.delete(container);
			}
			try {
				await act(async () => root.render(createElement(RegistryContext.Provider, { value: registry }, child)));
			} catch (error) {
				await close();
				throw error;
			}
			const screen = { close, container };
			engine.screens.set(kind, screen);
			return screen;
		}),
		(screen) => Effect.promise(screen.close).pipe(Effect.timeout("5 seconds"), Effect.orDie),
	);
}

function getContainer(engine: Application, kind: string) {
	const screen = engine.screens.get(kind);
	if (screen === undefined) {
		throw new Error(`The ${kind} screen is not open`);
	}
	return screen.container;
}

function input(engine: Application) {
	const element = getContainer(engine, "editor").querySelector<HTMLInputElement>('input[name="quantity"]');
	if (element === null) {
		throw new Error("The quantity input is not rendered");
	}
	return element;
}

function observe(engine: Application, label: string, read: () => unknown, expected: unknown) {
	return Effect.promise(() =>
		eventually(() => {
			const value = read();
			engine.observations[label] = value;
			expect(value, label).toEqual(expected);
		}),
	);
}

export function screenVerbs(engine: Application, tell: (line: string) => void) {
	function click(kind: string, selector: string) {
		return Effect.promise(async () => {
			const button = getContainer(engine, kind).querySelector<HTMLButtonElement>(selector);
			if (button === null) {
				throw new Error(`Missing button ${selector}`);
			}
			await act(async () => button.click());
		});
	}
	return {
		editQuantity: (value: string) => {
			tell(`Alice enters quantity ${value}`);
			return Effect.promise(async () => {
				await act(async () => {
					const element = input(engine);
					Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, value);
					element.dispatchEvent(new Event("input", { bubbles: true }));
					element.dispatchEvent(new Event("change", { bubbles: true }));
					await Promise.resolve();
				});
			});
		},
		formIsReady: () => observe(engine, "quantity", () => input(engine).value, "3"),
		formIsSaved: () =>
			observe(
				engine,
				"status",
				() => {
					const container = getContainer(engine, "editor");
					expect(container.querySelector<HTMLButtonElement>("button")?.disabled, "the saved order's query finished refreshing").toBe(false);
					return container.querySelector('[role="status"]')?.textContent;
				},
				"Saved",
			),
		formShowsError: (message: string) =>
			observe(engine, "form error", () => getContainer(engine, "editor").querySelector('[role="alert"]')?.textContent, message),
		listShows: (text: string) => observe(engine, "list", () => getContainer(engine, "list").querySelector("li")?.textContent, text),
		quantityDraftIs: (value: string) => observe(engine, "quantity", () => input(engine).value, value),
		renameFromList: () => {
			tell("Alice renames the order from the list");
			return click("list", 'button[data-action="rename"]');
		},
		submitOrder: () => {
			tell("Alice submits the order");
			return click("editor", 'button[type="submit"]');
		},
	};
}
