import { Effect, Layer } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import type { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import type { AdminPage } from "#page.ts";
import type { AdminRegistry } from "#registry.ts";
import { pagePermissions } from "./pagePermissions.ts";

type HandlerLayers<TPages extends readonly AdminPage[]> = {
	readonly [TPage in TPages[number] as TPage["id"]]: Layer.Layer<Rpc.ToHandler<RpcGroup.Rpcs<TPage["contract"]["application"]>>, unknown, unknown>;
};

type RegisteredLayers<THandlers> = Extract<THandlers[keyof THandlers], Layer.Any>;

export function registerAdmin<const TPages extends readonly AdminPage[], THandlers extends HandlerLayers<TPages>>(
	registry: AdminRegistry<TPages>,
	handlers: THandlers & Record<Exclude<keyof THandlers, TPages[number]["id"]>, never>,
): {
	readonly group: AdminRegistry<TPages>["group"];
	readonly pages: TPages;
	readonly handlers: Layer.Layer<
		| Layer.Success<RegisteredLayers<THandlers>>
		| Extract<Rpc.Middleware<RpcGroup.Rpcs<TPages[number]["contract"]>>, { readonly key: TPages[number]["permissionKey"] }>,
		Layer.Error<RegisteredLayers<THandlers>>,
		Layer.Services<RegisteredLayers<THandlers>> | SessionPolicy
	>;
};
export function registerAdmin(
	registry: AdminRegistry<readonly AdminPage[]>,
	handlers: Readonly<Record<string, Layer.Layer<never, unknown, unknown>>>,
): { readonly group: RpcGroup.Any; readonly handlers: Layer.Layer<never, unknown, unknown>; readonly pages: readonly AdminPage[] } {
	const registered = Layer.suspend(() => {
		const ids = new Set(registry.pages.map((page) => page.id));
		for (const id of ids) {
			if (!Object.hasOwn(handlers, id)) {
				return Layer.effectDiscard(Effect.die(new Error(`Missing admin handlers: ${id}`)));
			}
		}
		for (const id of Object.keys(handlers)) {
			if (!ids.has(id)) {
				return Layer.effectDiscard(Effect.die(new Error(`Unregistered admin handlers: ${id}`)));
			}
		}
		return Layer.mergeAll(Layer.empty, ...Object.values(handlers)).pipe(Layer.provideMerge(pagePermissions(registry)));
	});
	return { group: registry.group, handlers: registered, pages: registry.pages };
}
