import type { AnyRootRoute, AnyRoute } from "@tanstack/react-router";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { AuthActions } from "./auth.ts";

export interface RouteContext {
	readonly auth: AuthActions;
	readonly navigate: (path: string) => void;
	readonly registry: AtomRegistry.AtomRegistry;
	readonly root: AnyRootRoute;
}

export interface ClientModule {
	readonly api: unknown;
	readonly routes: (context: RouteContext) => readonly AnyRoute[];
}

export interface AppConnection {
	readonly modules: readonly ClientModule[];
}

export function connectModules(modules: readonly ClientModule[]): AppConnection {
	return { ...Object.fromEntries(modules.map((module, index) => [index, module.api])), modules };
}
