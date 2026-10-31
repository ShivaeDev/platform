import { type AnyRoute, createRoute, createRouter, type RouterHistory, useRouterState } from "@tanstack/react-router";
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { ReactElement, ReactNode } from "react";
import type { AppSession, AuthActions } from "./auth.ts";
import { Home } from "./Home.tsx";
import { LoginScreen } from "./LoginScreen.tsx";
import type { ClientModule } from "./Module.ts";
import type { clientModules } from "./modules.ts";
import { rootRoute } from "./rootRoute.ts";
import { parseSearch, stringifySearch } from "./search.ts";

export const appRouter = Effect.fnUntraced(function* <TRoute extends AnyRoute>(
	client: { readonly modules: readonly ClientModule<TRoute>[] },
	auth: AuthActions,
	history?: RouterHistory,
	session: () => AppSession | null | undefined = () => undefined,
	onAuthenticated: () => void = () => undefined,
) {
	const registry = yield* AtomRegistry.AtomRegistry;
	const root = rootRoute();
	const login = createRoute({
		component: (): ReactElement => <LoginScreen auth={auth} onAuthenticated={onAuthenticated} />,
		getParentRoute: () => root,
		path: "/sign-in",
		validateSearch: (search: Record<string, unknown>) => (typeof search.returnTo === "string" ? { returnTo: search.returnTo } : {}),
	});
	const adminPages = client.modules.flatMap((module) => module.admin?.pages ?? []);
	const routes = client.modules.flatMap((module) => module.routes({ getParentRoute: () => root }));
	const home = createRoute({ component: (): ReactElement => <Home auth={auth} />, getParentRoute: () => root, path: "/" });
	const router = createRouter({
		context: { adminPages, auth, navigate: (to) => void router.navigate({ href: to }), registry, session },
		defaultPendingMs: Number.POSITIVE_INFINITY,
		disableGlobalCatchBoundary: true,
		InnerWrap: RouteShell,
		parseSearch,
		stringifySearch,
		...(history === undefined ? {} : { history }),
		routeTree: root.addChildren([
			login,
			...routes,
			...(routes.flatMap((route) => route.children ?? [route]).some((route) => "path" in route.options && route.options.path === "/") ? [] : [home]),
		]),
	});
	return router;
});

function RouteShell({ children }: { readonly children: ReactNode }): ReactElement {
	const pending = useRouterState({ select: (state) => state.isLoading });
	const loading = pending && <p role="status">Loading…</p>;
	return (
		<>
			{loading}
			{children}
		</>
	);
}

declare module "@tanstack/react-router" {
	interface Register {
		router: Effect.Success<ReturnType<typeof appRouter<ReturnType<ReturnType<typeof clientModules>["modules"][number]["routes"]>[number]>>>;
	}
}
