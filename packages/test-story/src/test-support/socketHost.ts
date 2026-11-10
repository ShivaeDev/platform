import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Cause, Deferred, Effect, Exit, Fiber, Layer, Option, Schema, Scope } from "effect";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { rpcSocketHost } from "#server/rpcSocketHost.ts";
import { storyKit } from "#server/storyKit.ts";

const Echo = RpcGroup.make(Rpc.make("echo", { payload: { text: Schema.String }, success: Schema.String }));

function ending(exit: Exit.Exit<void, Socket.SocketError>) {
	const failure = Exit.isFailure(exit) ? Cause.findErrorOption(exit.cause) : Option.none();
	return Option.isSome(failure) && failure.value.reason._tag === "SocketOpenError" ? "never opened" : "closed";
}

export const socketHost = storyKit({
	clock: "test",
	*create() {
		const hostScope = yield* Scope.fork(yield* Scope.Scope);
		const host = yield* rpcSocketHost(Echo, Echo.toLayer({ echo: ({ text }) => Effect.succeed(text) })).pipe(
			Effect.provideService(Scope.Scope, hostScope),
		);
		const sockets = new Map<string, Fiber.Fiber<void, Socket.SocketError>>();
		return { host, hostScope, sockets, url: host.url.replace(/^http/u, "ws") };
	},
	inspect: ({ host, sockets }) => Effect.map(host.handshakes, (handshakes) => ({ handshakes, sockets: [...sockets.keys()] })),
	name: "RPC socket host",
	stages: [],
	verbs: ({ host, hostScope, sockets, url }, story) => {
		function opening(name: string) {
			return Effect.gen(function* () {
				const opened = yield* Deferred.make<void>();
				const socket = yield* Socket.makeWebSocket(url);
				const fiber = yield* Effect.scoped(
					Effect.gen(function* () {
						const reader = yield* socket.reader;
						yield* Deferred.succeed(opened, undefined);
						yield* Effect.forever(reader.pull);
					}),
				).pipe(Effect.asVoid, Effect.forkScoped);
				sockets.set(name, fiber);
				return opened;
			}).pipe(Effect.provide(layerWebSocketConstructor));
		}
		return {
			accepts: () => {
				story.tell("the host accepts handshakes again");
				return host.accept;
			},
			asks: (name: string) =>
				Effect.gen(function* () {
					story.tell(`${name} opens a new socket and asks for an echo of their name`);
					const client = yield* RpcClient.make(Echo);
					return yield* client.echo({ text: name });
				}).pipe(
					Effect.scoped,
					Effect.provide(
						RpcClient.layerProtocolSocket({ retryTransientErrors: false }).pipe(
							Layer.provide([Socket.layerWebSocket(url), RpcSerialization.layerNdjson]),
							Layer.provide(layerWebSocketConstructor),
						),
					),
				),
			closesHost: () => {
				story.tell("the story closes the host's scope");
				return Scope.close(hostScope, Exit.void);
			},
			handshakes: () => host.handshakes,
			held: () => host.held,
			holds: () => {
				story.tell("the host holds later handshakes");
				return host.hold;
			},
			nextHandshake: () => host.nextHandshake,
			opens: (name: string) =>
				Effect.gen(function* () {
					story.tell(`${name} opens a socket`);
					yield* Deferred.await(yield* opening(name));
				}),
			pauses: () => {
				story.tell("the host stops reading its open sockets");
				return host.pause;
			},
			refuses: () => {
				story.tell("the host refuses later handshakes");
				return host.refuse;
			},
			socketEnd: (name: string) =>
				Effect.gen(function* () {
					const fiber = sockets.get(name);
					if (fiber === undefined) {
						return yield* Effect.die(`Open ${name}'s socket before reading how it ended.`);
					}
					return ending(yield* Fiber.await(fiber));
				}),
			startsOpening: (name: string) => {
				story.tell(`${name} starts opening a socket`);
				return Effect.asVoid(opening(name));
			},
		};
	},
});
