import { createRootRouteWithContext, createRoute, createRouter, type RouterHistory } from "@tanstack/react-router";
import { createElement } from "react";
import { BoardShell } from "./BoardShell.tsx";
import { type BoardLoaderContext, loadBoardPage, openBoardPage, type RouterShell } from "./loadBoardPage.ts";
export function boardRouter(options?: RouterShell, history?: RouterHistory) {
	let opening: Promise<void> | undefined;
	let navigated: () => void = () => undefined;
	function loader(context: BoardLoaderContext): ReturnType<typeof loadBoardPage> | undefined {
		if (router.state.resolvedLocation === undefined && !context.preload) {
			// The router never aborts a loader that has returned, so a navigation that loads first must end the opening view too.
			const next = new Promise<void>((resolve) => {
				navigated = () => resolve();
			});
			opening = Promise.race([openBoardPage(context), next]);
			return undefined;
		}
		const loading = loadBoardPage(context);
		if (!context.preload) {
			void loading.then(navigated, navigated);
		}
		return loading;
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
