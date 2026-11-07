import { Context, Effect, Layer, Option, Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { type Rpc, RpcClient, RpcGroup } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import { withClientProtocol } from "#adapters/withClientProtocol.ts";
import { clientActivities, makeActivity } from "#clientActivities.ts";
import { Activity } from "#clientActivity.ts";
import type { ClientOptions } from "#clientOptions.ts";
import { connectionProtocol, protocolConnections } from "#connectionProtocol.ts";
import { commandConnections } from "#connectionReadiness.ts";
import type { ResumeWindow } from "#resume.ts";
import { CommandInvalidation } from "#serverMetadata.ts";
import { socketProtocol } from "#socketProtocol.ts";

declare const window: ResumeWindow | undefined;

export interface RpcSource {
	readonly annotations: Context.Context<never>;
	readonly requests: ReadonlyMap<string, Rpc.Any>;
}

export function rpcClient(name: string, source: RpcSource, options: ClientOptions) {
	const activity = makeActivity(options.runtime ?? Atom.runtime);
	const group = RpcGroup.make(...source.requests.values()).annotateMerge(source.annotations);
	const commands = new Set(
		[...group.requests].filter(([, rpc]) => Option.isSome(Context.getOption(rpc.annotations, CommandInvalidation))).map(([tag]) => tag),
	);
	function sharedProtocol(identity?: string) {
		return socketProtocol({
			bearerToken: options.bearerToken,
			headers: options.headers,
			identity,
			resume: options.resume,
			resumeWindow: options.resumeWindow ?? (typeof window === "undefined" ? undefined : window),
			url: options.url.replace(/^http/u, "ws"),
			webSocketConstructor: options.webSocketConstructor,
		});
	}
	function configuredProtocol() {
		const custom = options.protocol;
		if (custom === undefined) {
			return sharedProtocol;
		}
		if (typeof custom === "function") {
			return Atom.family((identity: string | undefined) => connectionProtocol(custom(identity)));
		}
		const layer = connectionProtocol(custom);
		return () => layer;
	}
	const protocolFor = configuredProtocol();
	const protocol = protocolFor(undefined);
	function observeClient(client: RpcClient.RpcClient.Flat<Rpc.Any, RpcClientError>, wait: Effect.Effect<void, RpcClientError>) {
		const observed = new Proxy(client, {
			apply(target, receiver, args) {
				const result = Reflect.apply(target, receiver, args);
				if (String(args[0]).endsWith(".$changes") && Stream.isStream(result)) {
					// Publish after the consumer handles the hint so idle cannot race its invalidation.
					return result.pipe(
						Stream.flatMap((hint) => Stream.concat(Stream.succeed(hint), Stream.fromEffect(Effect.sync(activity.hint)).pipe(Stream.drain))),
					);
				}
				return Effect.isEffect(result) && !args[2]?.asQueue ? activity.track(result, commands.has(args[0])) : result;
			},
		});
		commandConnections.set(observed, wait);
		return observed;
	}
	const make = Effect.gen(function* () {
		const transport = yield* RpcClient.Protocol;
		const connection = protocolConnections.get(transport);
		const wait = connection === undefined ? Effect.void : Effect.suspend(() => (connection.isReady() ? Effect.void : activity.hold(connection.wait)));
		const native = yield* RpcClient.make<Rpc.Any, true>(group, { flatten: true });
		return observeClient(native, wait);
	});
	const Client = AtomRpc.Service<unknown>()(`${name}/Client`, {
		group,
		makeEffect: make,
		protocol: typeof options.protocol === "object" ? protocol : (get) => protocolFor(get(socketIdentity)),
		runtime: options.runtime,
	});
	clientActivities.set(Client, activity);
	const directClient = withClientProtocol(protocol, make).pipe(
		Effect.map((flat) =>
			Object.fromEntries([...group.requests.keys()].map((tag) => [tag, (payload: never, callOptions: never) => flat(tag, payload, callOptions)])),
		),
	);
	const layer = Layer.effect(Client, make).pipe(Layer.provide(protocol));
	return Object.assign(layer, { [Activity]: activity.activity, Client, client: directClient, runtime: Client.runtime });
}

export const socketIdentity = Atom.make<string | undefined>(undefined);
