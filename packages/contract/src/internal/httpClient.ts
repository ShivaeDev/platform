import { type Context, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { type Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import type { ClientOptions } from "#clientOptions.ts";

export interface HttpGroup {
	readonly annotations: Context.Context<never>;
	readonly requests: ReadonlyMap<string, Rpc.Any>;
}

export function httpClient(name: string, source: HttpGroup, options: ClientOptions) {
	const group = RpcGroup.make(...source.requests.values()).annotateMerge(source.annotations);
	const protocol = RpcClient.layerProtocolHttp(options).pipe(
		Layer.provide([options.httpClient ?? FetchHttpClient.layer, options.serialization ?? RpcSerialization.layerNdjson]),
	);
	const Client = AtomRpc.Service<unknown>()(`${name}/Client`, { group, protocol });
	const client = RpcClient.make(group).pipe(Effect.provide(protocol));
	const layer = Layer.effect(Client, RpcClient.make(group, { flatten: true })).pipe(Layer.provide(protocol));
	return Object.assign(layer, { Client, client, runtime: Client.runtime });
}
