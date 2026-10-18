import { createRootRouteWithContext, createRoute, createRouter, type RouterHistory } from "@tanstack/react-router";
import { createElement } from "react";
import { BoardShell } from "./BoardShell.tsx";
import { type BoardLoaderContext, loadBoardPage, openBoardPage, type RouterShell } from "./loadBoardPage.ts";
export function boardRouter(options?: RouterShell, history?: RouterHistory) {
	let opening: Promise<void> | undefined;
	function loader(context: BoardLoaderContext): ReturnType<typeof loadBoardPage> | undefined {
		if (router.state.resolvedLocation === undefined && !context.preload) {
			opening = openBoardPage(context);
			return undefined;
		}
		return loadBoardPage(context);
	}
	const root = createRootRouteWithContext<{ readonly shell?: RouterShell }>()({
		component: () => {
			const { shell } = root.useRouteContext();
			return shell ? createElement(BoardShell, { ...shell, opening }) : null;
		},
	});
	const home = createRoute({
		component: () => null,
		getParentRoute: () => root,
		loader,
		loaderDeps: ({ search }) => search,
		path: "/",
	});
	const page = createRoute({
		component: () => null,
		getParentRoute: () => root,
		loader,
		loaderDeps: ({ search }) => search,
		path: "$",
	});
	const router = createRouter({
		...(history ? { history } : {}),
		context: options ? { shell: options } : {},
		defaultPendingMs: Number.POSITIVE_INFINITY,
		defaultPreloadStaleTime: 0,
		defaultStaleReloadMode: "blocking",
		routeTree: root.addChildren([home, page]),
		trailingSlash: "preserve",
	});
	return router;
}
