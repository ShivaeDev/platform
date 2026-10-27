import type { AnyRoute } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { PermissionSession } from "@shivaedev/react/permissions.ts";
import type { AuthActions } from "./auth.ts";
import type { rootRoute } from "./rootRoute.ts";

export interface RouteContext {
	readonly auth: AuthActions;
	readonly navigate: (path: string) => void;
	readonly registry: AtomRegistry.AtomRegistry;
	readonly root: ReturnType<typeof rootRoute>;
	readonly session: () => PermissionSession | null | undefined;
}

export interface ClientModule<TRoute extends AnyRoute = AnyRoute> {
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
