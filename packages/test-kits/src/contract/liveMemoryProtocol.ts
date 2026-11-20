import { Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { Rpc, RpcGroup } from "effect/rpc";
import { commandGuardLayer, guardCommands } from "@shivaedev/contract/CommandGuard.ts";
import { LiveSync } from "@shivaedev/contract/LiveSync.ts";
import { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { liveSyncLayer } from "@shivaedev/server/liveSyncLayer.ts";
import { publishCommand } from "@shivaedev/server/publishCommand.ts";
import { layerMemoryProtocol, type MemoryProtocolOptions } from "#contract/testing.ts";

type Channel = Layer.Success<typeof liveServerLayer> | Reactivity.Reactivity;

// Each host owns its change channel, also when several clients share one runtime's memo map.
export function liveChannel(): Layer.Layer<Channel> {
	return Layer.fresh(liveServerLayer.pipe(Layer.provideMerge(Reactivity.layer)));
}

export function liveHost<R extends Rpc.Any, THandlers, E, TRequirements>(
	group: RpcGroup.RpcGroup<R>,
	handlers: Layer.Layer<THandlers, E, TRequirements>,
	channel: Layer.Layer<Channel> = liveChannel(),
) {
	const confirmed = Layer.unwrap(
		Effect.map(Effect.context<Channel>(), (context) =>
			commandGuardLayer((effect, keys, sync) => Effect.provideContext(publishCommand(effect, keys, sync), context)),
		),
	);
	const changes = hostChanges(group).pipe(Layer.provide(handlers));
	return Effect.map(guardCommands(group.merge(LiveSync.application)), (served) => ({
		group: served,
		handlers: Layer.mergeAll(handlers, changes, liveSyncLayer, confirmed).pipe(Layer.provide(channel)),
	}));
}

export function layerLiveMemoryProtocol<R extends Rpc.Any, THandlers, E, TRequirements>(
	group: RpcGroup.RpcGroup<R>,
	handlers: Layer.Layer<THandlers, E, TRequirements>,
	options?: MemoryProtocolOptions,
) {
	return Layer.unwrap(Effect.map(liveHost(group, handlers), (host) => layerMemoryProtocol(host.group, options).pipe(Layer.provide(host.handlers))));
}
