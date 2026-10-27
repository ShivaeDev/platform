import { createRootRouteWithContext, createRoute, createRouter, type RouterHistory, useRouterState } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { ReactNode } from "react";
import { permissionGuard } from "@shivaedev/react/permissionGuard.ts";
import type { PermissionSession } from "@shivaedev/react/permissions.ts";
import type { AuthActions } from "./auth.ts";
import { Home } from "./Home.tsx";
import { LoginScreen } from "./LoginScreen.tsx";
import type { AppConnection } from "./Module.ts";

export function appRouter(
	registry: AtomRegistry.AtomRegistry,
	client: AppConnection,
	auth: AuthActions,
	history?: RouterHistory,
	session: () => PermissionSession | null | undefined = () => undefined,
) {
	const root = createRootRouteWithContext<{ readonly registry: AtomRegistry.AtomRegistry }>()({
		beforeLoad: permissionGuard({ session, signIn: "/sign-in" }),
	});
	const login = createRoute({
		component: () => {
			const { returnTo } = login.useSearch();
			return <LoginScreen auth={auth} onAuthenticated={() => void router.navigate({ href: returnTo })} />;
		},
		getParentRoute: () => root,
		path: "/sign-in",
		validateSearch: (search: Record<string, unknown>) => ({ returnTo: typeof search.returnTo === "string" ? search.returnTo : "/" }),
	});
	const routes = client.modules.flatMap((module) => module.routes({ auth, navigate: (to) => void router.navigate({ to }), registry, root }));
	const home = createRoute({ component: () => <Home auth={auth} />, getParentRoute: () => root, path: "/" });
	const router = createRouter({
		context: { registry },
		defaultPendingMs: Number.POSITIVE_INFINITY,
		disableGlobalCatchBoundary: true,
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
