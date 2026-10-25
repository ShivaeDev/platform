import { Layer } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import type { AdminPage } from "#page.ts";
import type { AdminRegistry } from "#registry.ts";

type HandlerLayers<TPages extends readonly AdminPage[]> = {
	readonly [TPage in TPages[number] as TPage["id"]]: Layer.Layer<Rpc.ToHandler<RpcGroup.Rpcs<TPage["contract"]["application"]>>, unknown, unknown>;
};

type RegisteredLayers<THandlers> = Extract<THandlers[keyof THandlers], Layer.Any>;

export function registerAdmin<const TPages extends readonly AdminPage[], THandlers extends HandlerLayers<TPages>>(
	registry: AdminRegistry<TPages>,
	handlers: THandlers & Record<Exclude<keyof THandlers, TPages[number]["id"]>, never>,
): {
	readonly group: AdminRegistry<TPages>["group"];
	readonly handlers: Layer.Layer<
		Layer.Success<RegisteredLayers<THandlers>>,
		Layer.Error<RegisteredLayers<THandlers>>,
		Layer.Services<RegisteredLayers<THandlers>>
	>;
};
export function registerAdmin(
	registry: AdminRegistry<readonly AdminPage[]>,
	handlers: Readonly<Record<string, Layer.Layer<never, unknown, unknown>>>,
) {
	const ids = new Set(registry.pages.map((page) => page.id));
	for (const id of ids) {
		if (!Object.hasOwn(handlers, id)) {
			throw new Error(`Missing admin handlers: ${id}`);
		}
	}
	for (const id of Object.keys(handlers)) {
		if (!ids.has(id)) {
			throw new Error(`Unregistered admin handlers: ${id}`);
		}
	}
	return { group: registry.group, handlers: Layer.mergeAll(Layer.empty, ...Object.values(handlers)) };
}
