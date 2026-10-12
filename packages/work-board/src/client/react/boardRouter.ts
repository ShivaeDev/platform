import { createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import { createElement } from "react";
import { BoardShell } from "./BoardShell.tsx";
import { loadBoardPage, type RouterShell } from "./loadBoardPage.ts";
export function boardRouter(options?: RouterShell) {
	const root = createRootRouteWithContext<{ readonly shell?: RouterShell }>()({
		component: () => {
			const { shell } = root.useRouteContext();
			return shell ? createElement(BoardShell, shell) : null;
		},
	});
	const home = createRoute({
		component: () => null,
		getParentRoute: () => root,
		loader: loadBoardPage,
		loaderDeps: ({ search }) => search,
		path: "/",
	});
	const page = createRoute({
		component: () => null,
		getParentRoute: () => root,
		loader: loadBoardPage,
		loaderDeps: ({ search }) => search,
		path: "$",
	});
	return createRouter({
		context: options ? { shell: options } : {},
		defaultPendingMs: Number.POSITIVE_INFINITY,
		defaultPreloadStaleTime: 0,
		defaultStaleReloadMode: "blocking",
		routeTree: root.addChildren([home, page]),
		trailingSlash: "preserve",
	});
}
