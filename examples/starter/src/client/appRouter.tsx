import { type AnyRoute, createRoute, createRouter, type RouterHistory, useRouterState } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { ReactElement, ReactNode } from "react";
import type { PermissionSession } from "@shivaedev/react/permissions.ts";
import { signInSearch } from "@shivaedev/react/signInSearch.ts";
import { routerRedirect } from "#client/adapters/routerRedirect.ts";
import type { AuthActions } from "./auth.ts";
import { Home } from "./Home.tsx";
import { LoginScreen } from "./LoginScreen.tsx";
import type { ClientModule } from "./Module.ts";
import type { clientModules } from "./modules.ts";
import { rootRoute } from "./rootRoute.ts";
import { parseSearch, returnPath, stringifySearch } from "./search.ts";

export function appRouter<TRoute extends AnyRoute>(
	registry: AtomRegistry.AtomRegistry,
	client: { readonly modules: readonly ClientModule<TRoute>[] },
	auth: AuthActions,
	history?: RouterHistory,
	session: () => PermissionSession | null | undefined = () => undefined,
) {
	const root = rootRoute();
	const login = createRoute({
		beforeLoad: ({ search, location }) => {
			const { returnTo } = signInSearch({ ...location, href: search.returnTo ?? "/" });
			const current = session();
			if (current !== null && current !== undefined && returnTo !== undefined) {
				routerRedirect(returnTo);
			}
		},
		component: (): ReactElement => {
			const { returnTo } = login.useSearch();
			return <LoginScreen auth={auth} onAuthenticated={() => void router.navigate({ href: returnTo ?? "/" })} />;
		},
		getParentRoute: () => root,
		path: "/sign-in",
		validateSearch: (search: Record<string, unknown>) => (search.returnTo === undefined ? {} : { returnTo: returnPath(search.returnTo) }),
	});
	const routes = client.modules.flatMap((module) =>
		module.routes({ auth, navigate: (to) => void router.navigate({ href: to }), registry, root, session }),
	);
	const home = createRoute({ component: (): ReactElement => <Home auth={auth} />, getParentRoute: () => root, path: "/" });
	const router = createRouter({
		context: { registry },
		defaultPendingMs: Number.POSITIVE_INFINITY,
		disableGlobalCatchBoundary: true,
		InnerWrap: RouteShell,
		parseSearch,
		stringifySearch,
		...(history === undefined ? {} : { history }),
		routeTree: root.addChildren([login, ...(routes.length === 0 ? [home] : routes)]),
	});
	return router;
}

function RouteShell({ children }: { readonly children: ReactNode }): ReactElement {
	const pending = useRouterState({ select: (state) => state.isLoading });
	return (
		<>
			{pending && <p role="status">Loading…</p>}
			{children}
		</>
	);
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof appRouter<ReturnType<ReturnType<typeof clientModules>["modules"][number]["routes"]>[number]>>;
	}
}
