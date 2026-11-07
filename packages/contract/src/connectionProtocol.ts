import { Context, Effect, Layer, Option } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { RpcClient } from "effect/rpc";
import { ConnectionReadiness, connectionReadiness } from "#connectionReadiness.ts";

export const protocolConnections = new WeakMap<RpcClient.Protocol["Service"], Effect.Success<typeof connectionReadiness>>();

export const connectionProtocol = Atom.family((protocol: Layer.Layer<RpcClient.Protocol, never, ConnectionReadiness>) =>
	Layer.unwrap(
		Effect.gen(function* () {
			const connection = yield* connectionReadiness;
			const hooks = yield* Effect.serviceOption(RpcClient.ConnectionHooks);
			return protocol.pipe(
				Layer.provide(
					Layer.merge(
						Layer.succeed(ConnectionReadiness, connection),
						Layer.succeed(RpcClient.ConnectionHooks, {
							onConnect: connection.open.pipe(Effect.andThen(Option.isSome(hooks) ? hooks.value.onConnect : Effect.void)),
							onDisconnect: connection.close.pipe(Effect.andThen(Option.isSome(hooks) ? hooks.value.onDisconnect : Effect.void)),
						}),
					),
				),
				Layer.tap((context) => Effect.sync(() => protocolConnections.set(Context.get(context, RpcClient.Protocol), connection))),
			);
		}),
	),
);
