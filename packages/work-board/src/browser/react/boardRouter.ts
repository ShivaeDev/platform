import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";

const root = createRootRoute({ component: Outlet });
const placeholder = createRoute({ component: () => null, getParentRoute: () => root, path: "/" });

export function boardRouter() {
	return createRouter({ routeTree: root.addChildren([placeholder]) });
}
