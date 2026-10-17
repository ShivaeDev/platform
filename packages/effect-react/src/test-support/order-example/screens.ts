import { RegistryContext } from "@effect/atom-react";
import { NodeHttpClient } from "@effect/platform-node";
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { type Application, orderId } from "./applicationEngine.ts";
import { makeOrderEditor } from "./frontend.tsx";

export const activeScreens = new Set<HTMLDivElement>();
Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

export function openScreens(engine: Application, editors: Readonly<Record<string, string>>, list?: string, token: string | null = "alice-session") {
	return Effect.acquireRelease(
		Effect.promise(async () => {
			window.location.href = engine.url;
			const views = makeOrderEditor({ httpClient: NodeHttpClient.layerNodeHttp, token: token ?? undefined, url: engine.url });
			const registry = AtomRegistry.make();
			const container = document.createElement("div");
			document.body.append(container);
			activeScreens.add(container);
			const root = createRoot(container);
			async function close() {
				await act(async () => root.unmount());
				registry.dispose();
				container.remove();
				activeScreens.delete(container);
			}
			try {
				const panels = Object.entries(editors).map(([key, alias]) =>
					createElement("div", { "data-editor": key, key }, createElement(views.Editor, { id: orderId(engine, alias) })),
				);
				const orderList = list === undefined ? null : createElement(views.OrderList, { renameId: orderId(engine, list) });
				const content = createElement(RegistryContext.Provider, { value: registry }, orderList, ...panels);
				await act(async () => root.render(content));
				for (const key of Object.keys(editors)) {
					const panel = container.querySelector<HTMLElement>(`[data-editor="${key}"]`);
					if (panel === null) {
						throw new Error(`Missing editor ${key}`);
					}
					engine.screens.set(key, { close, container: panel });
				}
				if (list !== undefined) {
					engine.screens.set("list", { close, container });
				}
			} catch (error) {
				await close();
				throw error;
			}
			return { close, container };
		}),
		(screen) => Effect.promise(screen.close).pipe(Effect.timeout("5 seconds"), Effect.orDie),
	);
}

export function openScreen(engine: Application, alias: string, kind: "editor" | "list") {
	return kind === "editor" ? openScreens(engine, { editor: alias }) : openScreens(engine, {}, alias);
}

export function getContainer(engine: Application, key: string) {
	const screen = engine.screens.get(key);
	if (screen === undefined) {
		throw new Error(`The ${key} screen is not open`);
	}
	return screen.container;
}

export function input(engine: Application, name: string, key = "editor") {
	const element = getContainer(engine, key).querySelector<HTMLInputElement>(`input[name="${name}"]`);
	if (element === null) {
		throw new Error(`The ${name} input is not rendered`);
	}
	return element;
}
