import { type Context, Effect, Layer, Schedule } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { type Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import type { ClientOptions } from "#clientOptions.ts";

export interface RpcSource {
	readonly annotations: Context.Context<never>;
	readonly requests: ReadonlyMap<string, Rpc.Any>;
}

export function rpcClient(name: string, source: RpcSource, options: ClientOptions) {
	const group = RpcGroup.make(...source.requests.values()).annotateMerge(source.annotations);
	function sharedProtocol(identity?: string) {
		return socketProtocol({
			headers: options.headers,
			identity,
			url: options.url.replace(/^http/u, "ws"),
			webSocketConstructor: options.webSocketConstructor,
		});
	}
	const protocol = options.protocol ?? sharedProtocol();
	const Client = AtomRpc.Service<unknown>()(`${name}/Client`, {
		group,
		protocol: options.protocol ?? ((get) => sharedProtocol(get(socketIdentity))),
	});
	const client = Effect.flatMap(Layer.build(protocol), (context) => RpcClient.make(group).pipe(Effect.provideContext(context)));
	const layer = Layer.effect(Client, RpcClient.make(group, { flatten: true })).pipe(Layer.provide(protocol));
	return Object.assign(layer, { Client, client, runtime: Client.runtime });
}

export const socketIdentity = Atom.make<string | undefined>(undefined);

const socketMemoMap = Layer.makeMemoMapUnsafe();
const socketProtocol = Atom.family(
	(options: {
		readonly url: string;
		readonly headers: ClientOptions["headers"];
		readonly identity: string | undefined;
		readonly webSocketConstructor: ClientOptions["webSocketConstructor"];
	}) => {
		const protocol = RpcClient.layerProtocolSocket({
			retryPolicy: Schedule.jittered(Schedule.min([Schedule.exponential(500, 1.5), Schedule.spaced(5000)])),
		}).pipe(
			Layer.provide(
				Socket.layerWebSocket(options.url, { headers: options.headers }).pipe(
					Layer.provide(options.webSocketConstructor ?? Socket.layerWebSocketConstructorGlobal),
				),
			),
			Layer.provide(RpcSerialization.layerNdjson),
		);
		return Layer.effectContext(Effect.flatMap(Effect.scope, (scope) => Layer.buildWithMemoMap(protocol, socketMemoMap, scope)));
	},
);
