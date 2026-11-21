import { Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { Rpc, RpcGroup } from "effect/rpc";
import { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";
import { servedGroup } from "@shivaedev/server/servedGroup.ts";
import { servedHandlers } from "@shivaedev/server/servedHandlers.ts";
import { type LiveChannel, onChannel } from "#contract/adapters/onChannel.ts";
import { layerMemoryProtocol, type MemoryProtocolOptions } from "#contract/testing.ts";

// Each host owns its change channel, also when several clients share one runtime's memo map.
export function liveChannel(): Layer.Layer<LiveChannel> {
	return Layer.fresh(liveServerLayer.pipe(Layer.provideMerge(Reactivity.layer)));
}

export function liveHost<R extends Rpc.Any, THandlers, E, TRequirements>(
	group: RpcGroup.RpcGroup<R>,
	handlers: Layer.Layer<THandlers, E, TRequirements>,
	options: { readonly channel?: Layer.Layer<LiveChannel>; readonly protocol: "http" | "websocket" },
) {
	return Effect.map(servedGroup(group, options.protocol === "websocket"), (served) => ({
		group: served.group,
		handlers: Layer.mergeAll(servedHandlers(group, handlers), onChannel(served.guards)).pipe(Layer.provide(options.channel ?? liveChannel())),
	}));
}

export function layerLiveMemoryProtocol<R extends Rpc.Any, THandlers, E, TRequirements>(
	group: RpcGroup.RpcGroup<R>,
	handlers: Layer.Layer<THandlers, E, TRequirements>,
	options?: MemoryProtocolOptions,
) {
	return Layer.unwrap(
		Effect.map(liveHost(group, handlers, { protocol: "websocket" }), (host) =>
			layerMemoryProtocol(host.group, options).pipe(Layer.provide(host.handlers)),
		),
	);
}
