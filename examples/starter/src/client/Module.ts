import type { AnyRoute } from "@tanstack/react-router";
import type { AdminNavigation } from "./AdminNavigation.ts";
import type { rootRoute } from "./rootRoute.ts";

export interface RouteContext {
	readonly getParentRoute: () => ReturnType<typeof rootRoute>;
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
