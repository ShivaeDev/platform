import { createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import { createElement } from "react";
import { BoardShell, type ShellOptions } from "./BoardShell.tsx";
export function boardRouter(options?: ShellOptions) {
	const root = createRootRouteWithContext<{ readonly shell?: ShellOptions }>()({
		component: () => {
			const { shell } = root.useRouteContext();
			return shell ? createElement(BoardShell, shell) : null;
		},
	});
	const home = createRoute({ component: () => null, getParentRoute: () => root, path: "/" });
	const page = createRoute({ component: () => null, getParentRoute: () => root, path: "$" });
	return createRouter({ context: options ? { shell: options } : {}, routeTree: root.addChildren([home, page]), trailingSlash: "preserve" });
}
