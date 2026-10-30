import { NodeHttpClient } from "@effect/platform-node";
import { Effect } from "effect";
import { act, createElement, Fragment } from "react";
import { render } from "@shivaedev/test-story/client/react.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { type Application, orderId } from "./applicationEngine.ts";
import { Editor, OrderList } from "./Editor.tsx";
import { makeClient } from "./makeClient.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

export const openScreens = Effect.fn("Orders.openScreens")(function* (
	engine: Application,
	editors: Readonly<Record<string, string>>,
	list?: string,
	token: string | null = "alice-session",
) {
	const views = makeClient({ httpClient: NodeHttpClient.layerNodeHttp, token: token ?? undefined, url: engine.url });
	const panels = Object.entries(editors).map(([key, alias]) =>
		createElement("div", { "data-editor": key, key }, createElement(Editor, { client: views, id: orderId(engine, alias) })),
	);
	const orderList = list === undefined ? null : createElement(OrderList, { client: views, renameId: orderId(engine, list) });
	const root = yield* Effect.acquireRelease(
		Effect.promise(() => render(createElement(Fragment, null, orderList, ...panels))),
		(view) => Effect.promise(view.unmount),
	);
	const queries = Object.values(editors).map((alias) => views.api.get.query({ id: orderId(engine, alias) }));
	const driver = screenDriver({
		act: async (action) => {
			await act(action);
		},
		pending: () =>
			queries.some((query) => root.registry.get(query).waiting)
			|| (list !== undefined && (root.registry.get(views.api.list.query()).waiting || root.registry.get(views.renameOrder).waiting))
			|| [...root.container.querySelectorAll<HTMLButtonElement>('button[type="submit"]')].some((button) => button.disabled),
		root: root.container,
		tell: () => undefined,
	});
	for (const key of Object.keys(editors)) {
		const panel = root.container.querySelector<HTMLElement>(`[data-editor="${key}"]`);
		if (panel === null) {
			return yield* Effect.die(`Missing editor ${key}`);
		}
		engine.screens.set(key, { container: panel, driver: driver.within(panel) });
	}
	if (list !== undefined) {
		engine.screens.set("list", { container: root.container, driver });
	}
});

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
