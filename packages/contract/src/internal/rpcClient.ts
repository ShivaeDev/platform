import { type Context, Effect, Layer, Schedule, Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { type Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { Activity } from "#clientActivity.ts";
import type { ClientOptions } from "#clientOptions.ts";
import { clientActivities, makeActivity } from "./clientActivity.ts";

export interface RpcSource {
	readonly annotations: Context.Context<never>;
	readonly requests: ReadonlyMap<string, Rpc.Any>;
}

export function rpcClient(name: string, source: RpcSource, options: ClientOptions) {
	const activity = makeActivity();
	const group = RpcGroup.make(...source.requests.values()).annotateMerge(source.annotations);
	function sharedProtocol(identity?: string) {
		return socketProtocol({
			headers: options.headers,
			identity,
			url: options.url.replace(/^http/u, "ws"),
			webSocketConstructor: options.webSocketConstructor,
		});
	}
	const customProtocol = options.protocol;
	const protocolFor = typeof customProtocol === "function" ? customProtocol : sharedProtocol;
	const protocol = typeof customProtocol === "function" ? customProtocol(undefined) : (customProtocol ?? sharedProtocol());
	function observeClient<T extends (...args: never[]) => unknown>(client: T): T {
		return new Proxy(client, {
			apply(target, receiver, args) {
				const result = Reflect.apply(target, receiver, args);
				if (String(args[0]).endsWith(".$changes") && Stream.isStream(result)) {
					// Publish after the consumer handles the hint so idle cannot race its invalidation.
					return result.pipe(
						Stream.flatMap((hint) => Stream.concat(Stream.succeed(hint), Stream.fromEffect(Effect.sync(activity.hint)).pipe(Stream.drain))),
					);
				}
				return Effect.isEffect(result) && !args[2]?.asQueue ? activity.track(result) : result;
			},
		});
	}
	const make = RpcClient.make(group, { flatten: true }).pipe(Effect.map(observeClient));
	const Client = AtomRpc.Service<unknown>()(`${name}/Client`, {
		group,
		makeEffect: make,
		protocol: typeof customProtocol === "object" ? customProtocol : (get) => protocolFor(get(socketIdentity)),
	});
	clientActivities.set(Client, activity);
	const directClient = Effect.flatMap(Layer.build(protocol), (context) =>
		make.pipe(
			Effect.map((flat) =>
				Object.fromEntries([...group.requests.keys()].map((tag) => [tag, (payload: never, callOptions: never) => flat(tag, payload, callOptions)])),
			),
			Effect.provideContext(context),
		),
	);
	const layer = Layer.effect(Client, make).pipe(Layer.provide(protocol));
	return Object.assign(layer, { [Activity]: activity.activity, Client, client: directClient, runtime: Client.runtime });
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
