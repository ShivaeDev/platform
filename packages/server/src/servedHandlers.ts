import { Layer } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { hostChanges } from "#hostChanges.ts";
import { hostVersionLayer } from "#hostVersionLayer.ts";
import { liveSyncLayer } from "#liveSyncLayer.ts";

export function servedHandlers<R extends Rpc.Any, THandlers, E, TRequirements>(
	group: RpcGroup.RpcGroup<R>,
	handlers: Layer.Layer<THandlers, E, TRequirements>,
	buildVersion?: string,
) {
	return Layer.mergeAll(hostChanges(group).pipe(Layer.provideMerge(handlers)), hostVersionLayer(buildVersion), liveSyncLayer);
}
