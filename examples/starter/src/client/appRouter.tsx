import { type AnyRoute, createRoute, createRouter, type RouterHistory } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { ReactElement } from "react";
import { PermissionBoundaryError } from "@shivaedev/react/adapters/permissionBoundary.ts";
import type { AppConnection, ClientApp } from "@shivaedev/react/client/app.ts";
import { signInRedirect } from "@shivaedev/react/signInRedirect.ts";
import type { AppSession, AuthActions } from "#client/adapters/auth.ts";
import { navigateTo } from "#client/adapters/navigateTo.ts";
import { Home } from "#client/Home.tsx";
import { LoginScreen } from "#client/LoginScreen.tsx";
import type { clientModules } from "#client/modules.ts";
import { ResetPassword } from "#client/ResetPassword.tsx";
import { rootRoute } from "#client/rootRoute.ts";
import { Shell } from "#client/Shell.tsx";
import { parseSearch, stringifySearch } from "#client/search.ts";

export interface Routing<TRoute extends AnyRoute = AnyRoute> {
	readonly auth: AuthActions;
	readonly connection: AppConnection<TRoute>;
	readonly history?: RouterHistory | undefined;
	readonly onAuthenticated?: () => void;
	readonly registry: AtomRegistry.AtomRegistry;
	readonly session?: () => AppSession | null | undefined;
}

export function appRouter<TRoute extends AnyRoute>({
	auth,
	connection,
	history,
	onAuthenticated = () => undefined,
	registry,
	session = () => undefined,
}: Routing<TRoute>) {
	const root = rootRoute();
	const login = createRoute({
		component: (): ReactElement => <LoginScreen auth={auth} onAuthenticated={onAuthenticated} />,
		getParentRoute: () => root,
		path: "/sign-in",
		validateSearch: (search: Record<string, unknown>) => (typeof search.returnTo === "string" ? { returnTo: search.returnTo } : {}),
	});
	const resetPassword = createRoute({
		component: (): ReactElement => <ResetPassword auth={auth} token={resetPassword.useSearch().token} />,
		getParentRoute: () => root,
		path: "/reset-password",
		validateSearch: (search: Record<string, unknown>) => ({ token: typeof search.token === "string" ? search.token : "" }),
	});
	const routes = connection.routes(root);
	const home = createRoute({ component: (): ReactElement => <Home auth={auth} />, getParentRoute: () => root, path: "/" });
	const router = createRouter({
		context: {
			adminPages: connection.adminPages,
			auth,
			modules: connection.modules,
			navigate: (to) => navigateTo(router, to),
			redirects: { signedOut: signInRedirect("/sign-in") },
			registry,
			session,
		},
		defaultErrorComponent: PermissionBoundaryError,
		defaultPendingMs: Number.POSITIVE_INFINITY,
		disableGlobalCatchBoundary: true,
		InnerWrap: Shell,
		parseSearch,
		stringifySearch,
		...(history === undefined ? {} : { history }),
		routeTree: root.addChildren([
			login,
			resetPassword,
			...routes,
			...(routes.flatMap((route) => route.children ?? [route]).some((route) => "path" in route.options && route.options.path === "/") ? [] : [home]),
		]),
	});
	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof appRouter<typeof clientModules extends ClientApp<infer TRoute> ? TRoute : never>>;
	}
}
