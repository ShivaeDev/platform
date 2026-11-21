import {
	type AnyRoute,
	type AnyRouter,
	createRoute,
	createRouter,
	type RouterHistory,
	type SearchParser,
	type SearchSerializer,
	useRouter,
} from "@tanstack/react-router";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { type ComponentType, createElement, Fragment, type ReactNode } from "react";
import { PermissionBoundary, PermissionBoundaryError } from "#adapters/permissionBoundary.ts";
import { navigateTo } from "#client/adapters/navigateTo.ts";
import type { AppConnection, ClientApp } from "#client/app.ts";
import type { RegisteredAuth, RegisteredSession } from "#client/module.ts";
import { sessionRoot } from "#client/sessionRoot.ts";
import { Forbidden } from "#Forbidden.ts";
import { signInRedirect } from "#signInRedirect.ts";

export interface SessionRouting {
	readonly forbidden?: ReactNode;
	readonly home?: ComponentType;
	readonly parseSearch?: SearchParser;
	readonly shell?: ComponentType<{ readonly children: ReactNode }>;
	readonly stringifySearch?: SearchSerializer;
}

export interface SessionRouterOptions<TRoute extends AnyRoute> extends SessionRouting {
	readonly auth: RegisteredAuth;
	readonly connection: AppConnection<TRoute>;
	readonly history?: RouterHistory | undefined;
	readonly registry: AtomRegistry.AtomRegistry;
	readonly session?: (() => RegisteredSession | null | undefined) | undefined;
}

export const SIGN_IN = "/sign-in";

function childrenOf(route: AnyRoute): readonly AnyRoute[] {
	return Array.isArray(route.children) ? route.children : [];
}

// A pathless layout route passes its children's paths through, so they claim / as well.
function claimsHome(routes: readonly AnyRoute[]): boolean {
	return routes.some((route) => ("path" in route.options ? route.options.path === "/" : claimsHome(childrenOf(route))));
}

function PassThrough({ children }: { readonly children: ReactNode }): ReactNode {
	return createElement(Fragment, null, children);
}

interface Shell {
	readonly forbidden: ReactNode;
	readonly session: () => RegisteredSession | null | undefined;
	readonly shell: ComponentType<{ readonly children: ReactNode }>;
}

const shells = new WeakMap<AnyRouter, Shell>();

// The router renders its InnerWrap again whenever the provider above it renders, so the boundary reads the session as it is now.
function SessionShell({ children }: { readonly children: ReactNode }) {
	const router = useRouter<AnyRouter>();
	const { forbidden, session, shell } = shells.get(router) ?? { forbidden: null, session: () => undefined, shell: PassThrough };
	return createElement(PermissionBoundary, { fallback: forbidden, session: session() }, createElement(shell, null, children));
}

export function sessionRouter<TRoute extends AnyRoute>({
	auth,
	connection,
	forbidden = createElement(Forbidden, { to: "/" }),
	history,
	home,
	parseSearch,
	registry,
	session = () => undefined,
	shell = PassThrough,
	stringifySearch,
}: SessionRouterOptions<TRoute>) {
	const root = sessionRoot();
	const routes = connection.routes(root);
	const homeRoute = createRoute({ component: home, getParentRoute: () => root, path: "/" });
	const router = createRouter({
		context: {
			adminPages: connection.adminPages,
			auth,
			modules: connection.modules,
			navigate: (href: string) => navigateTo(router, href),
			redirects: { signedOut: signInRedirect(SIGN_IN) },
			registry,
			session,
		},
		defaultErrorComponent: PermissionBoundaryError,
		defaultPendingMs: Number.POSITIVE_INFINITY,
		disableGlobalCatchBoundary: true,
		InnerWrap: SessionShell,
		...(history === undefined ? {} : { history }),
		...(parseSearch === undefined ? {} : { parseSearch }),
		...(stringifySearch === undefined ? {} : { stringifySearch }),
		routeTree: root.addChildren([...routes, ...(home === undefined || claimsHome(routes) ? [] : [homeRoute])]),
	});
	shells.set(router, { forbidden, session, shell });
	return router;
}

export type SessionRouter<TApp extends ClientApp> = ReturnType<typeof sessionRouter<TApp extends ClientApp<infer TRoute> ? TRoute : never>>;
