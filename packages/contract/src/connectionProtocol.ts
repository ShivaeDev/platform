import { Context, Effect, Layer, Option } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { RpcClient } from "effect/rpc";
import { ConnectionReadiness, connectionReadiness } from "#connectionReadiness.ts";
import { makeReflection, type Reflection } from "#reflection.ts";

// Clients that share one transport share its readiness and its reflection, so a command waits on every stream of its connection.
export class ConnectionScope extends Context.Service<
	ConnectionScope,
	{ readonly connection: Effect.Success<typeof connectionReadiness>; readonly reflection: Reflection }
>()("@shivaedev/contract/ConnectionScope") {}

export const connectionProtocol = Atom.family((protocol: Layer.Layer<RpcClient.Protocol, never, ConnectionReadiness>) =>
	Layer.unwrap(
		Effect.gen(function* () {
			const connection = yield* connectionReadiness;
			const reflection = yield* makeReflection;
			const hooks = yield* Effect.serviceOption(RpcClient.ConnectionHooks);
			const managed = protocol.pipe(
				Layer.provide(
					Layer.merge(
						Layer.succeed(ConnectionReadiness, connection),
						Layer.succeed(RpcClient.ConnectionHooks, {
							onConnect: connection.open.pipe(Effect.andThen(Option.isSome(hooks) ? hooks.value.onConnect : Effect.void)),
							onDisconnect: connection.close.pipe(Effect.andThen(Option.isSome(hooks) ? hooks.value.onDisconnect : Effect.void)),
						}),
					),
				),
			);
			return Layer.merge(managed, Layer.succeed(ConnectionScope, { connection, reflection }));
		}),
	),
);
