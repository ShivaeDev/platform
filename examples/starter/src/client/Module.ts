import type { AnyRoute } from "@tanstack/react-router";
import type { Effect } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { ReactNode } from "react";
import { type BindingComposition, composeBindings, liveBindings } from "@shivaedev/contract/composeBindings.ts";
import type { AdminNavigation } from "#client/AdminNavigation.ts";
import type { rootRoute } from "#client/rootRoute.ts";

export interface RouteContext {
	readonly getParentRoute: () => ReturnType<typeof rootRoute>;
}

export interface ClientModule<TRoute extends AnyRoute = AnyRoute> {
	readonly admin?: { readonly pages: readonly AdminNavigation[] };
	readonly api: unknown;
	readonly bindings?: readonly unknown[];
	readonly footer?: ReactNode;
	readonly menu?: readonly ReactNode[];
	readonly overlays?: readonly ReactNode[];
	readonly routes: (context: RouteContext) => readonly TRoute[];
}

export type ClientRegistration = Effect.Effect<ClientModule, never, AtomRegistry.AtomRegistry>;

export interface AppConnection<TModules extends readonly ClientModule[] = readonly ClientModule[]> extends BindingComposition {
	readonly modules: TModules;
}

export type ClientConnection = (
	session: { readonly id: string },
	registry: AtomRegistry.AtomRegistry,
) => Effect.Effect<AppConnection, never, AtomRegistry.AtomRegistry>;

export function connectModules<const TModules extends readonly ClientModule[]>(modules: TModules): AppConnection<TModules> {
	return composeBindings(
		{ modules },
		modules.flatMap((module) => (module.bindings ?? [module.api]).flatMap(liveBindings)),
	);
}
