import type { AnyRoute } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { PermissionSession } from "@shivaedev/react/permissions.ts";
import type { AdminNavigation } from "#client/admin/Shell.tsx";
import type { AuthActions } from "./auth.ts";
import type { rootRoute } from "./rootRoute.ts";

export interface RouteContext {
	readonly adminPages: readonly AdminNavigation[];
	readonly auth: AuthActions;
	readonly navigate: (path: string) => void;
	readonly registry: AtomRegistry.AtomRegistry;
	readonly root: ReturnType<typeof rootRoute>;
	readonly session: () => PermissionSession | null | undefined;
}

export interface AdminRouteContext {
	readonly adminPages: RouteContext["adminPages"];
	readonly getParentRoute: () => RouteContext["root"];
	readonly session: RouteContext["session"];
}

export interface ClientModule<TRoute extends AnyRoute = AnyRoute> {
	readonly admin?: { readonly pages: readonly AdminNavigation[] };
	readonly api: unknown;
	readonly bindings?: readonly unknown[];
	readonly routes: (context: RouteContext) => readonly TRoute[];
}

export interface AppConnection<TModules extends readonly ClientModule[] = readonly ClientModule[]> {
	readonly modules: TModules;
}

export function connectModules<const TModules extends readonly ClientModule[]>(modules: TModules): AppConnection<TModules> {
	return { ...Object.fromEntries(modules.flatMap((module) => module.bindings ?? [module.api]).map((api, index) => [index, api])), modules };
}
