import { createRootRouteWithContext, createRoute, createRouter, type RouterHistory } from "@tanstack/react-router";
import { createElement } from "react";
import { type BoardLoaderContext, loadBoardPage, openBoardPage, type RouterShell } from "#client/react/adapters/loadBoardPage.ts";
import { BoardShell } from "./BoardShell.tsx";
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
		// The shell owns pending feedback (navigationTarget.ts) because its pages render outside route matches; a router pending component would also hold every slow page for pendingMinMs.
		// The shell scrolls to a link's passage once the page is ready to read (scheduleReading.ts); a second router scroll would move the page before that decision.
		defaultHashScrollIntoView: false,
		defaultPendingMs: Number.POSITIVE_INFINITY,
		defaultPreloadStaleTime: 0,
		defaultStaleReloadMode: "blocking",
		routeTree: root.addChildren([home, page]),
		trailingSlash: "preserve",
	});
	return router;
}
