import { createRootRouteWithContext, createRoute, createRouter, type RouterHistory, useRouterState } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { ReactNode } from "react";
import type { AuthActions } from "./auth.ts";
import { Home } from "./Home.tsx";
import { LoginScreen } from "./LoginScreen.tsx";
import type { AppConnection } from "./Module.ts";

export function appRouter(registry: AtomRegistry.AtomRegistry, client: AppConnection, auth: AuthActions, history?: RouterHistory) {
	const root = createRootRouteWithContext<{ readonly registry: AtomRegistry.AtomRegistry }>()();
	const login = createRoute({
		component: () => <LoginScreen auth={auth} onAuthenticated={() => void router.navigate({ to: "/" })} />,
		getParentRoute: () => root,
		path: "/sign-in",
	});
	const routes = client.modules.flatMap((module) => module.routes({ auth, navigate: (to) => void router.navigate({ to }), registry, root }));
	const home = createRoute({ component: () => <Home auth={auth} />, getParentRoute: () => root, path: "/" });
	const router = createRouter({
		context: { registry },
		defaultPendingMs: Number.POSITIVE_INFINITY,
		InnerWrap: RouteShell,
		...(history === undefined ? {} : { history }),
		routeTree: root.addChildren([login, ...(routes.length === 0 ? [home] : routes)]),
	});
	return router;
}

function RouteShell({ children }: { readonly children: ReactNode }) {
	const pending = useRouterState({ select: (state) => state.isLoading });
	return (
		<>
			{pending && <p role="status">Loading…</p>}
			{children}
		</>
	);
}
