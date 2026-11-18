import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Clock, Context, Deferred, Effect, type Fiber, Layer, Queue, Stream, SubscriptionRef } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { CommandPublication } from "@shivaedev/changes/commandPublication.ts";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { makeClient } from "#bind.ts";
import { clientActivity } from "#clientActivity.ts";
import { liveServerLayer } from "#live-server/layer.ts";
import { LiveServer } from "#live-server/service.ts";
import { SocketClock } from "#SocketClock.ts";
import { updateWords } from "#test/answers.ts";
import { Board } from "#test/reflection/fixture.ts";
import { syntheticNative } from "#test/resumeSources.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

interface Gate {
	held: Deferred.Deferred<void> | undefined;
	readonly reached: Queue.Queue<void>;
}

const makeGate = Effect.map(Queue.unbounded<void>(), (reached): Gate => ({ held: undefined, reached }));

function pass(gate: Gate) {
	return Effect.andThen(
		Queue.offer(gate.reached, undefined),
		Effect.suspend(() => (gate.held === undefined ? Effect.void : Deferred.await(gate.held))),
	);
}

function trackedSockets() {
	const opened: Socket.WebSocketLike[] = [];
	const layer = Layer.succeed(Socket.WebSocketConstructor)((url, options) => {
		const socket = typeof options === "string" || Array.isArray(options) ? new globalThis.WebSocket(url, options) : new globalThis.WebSocket(url);
		opened.push(socket);
		return socket;
	});
	return { layer, opened };
}

export const reflectionEngine = Effect.gen(function* () {
	const runtime = yield* storyRuntime;
	runtime.addGlobalLayer(Layer.succeed(SocketClock, yield* Clock.Clock));
	const host = { listening: true, refusing: false, value: "First" };
	const reads = yield* makeGate;
	const writes = yield* makeGate;
	const reactivity = yield* Reactivity.make;
	const local = CommandPublication.defaultValue();
	const live = yield* Layer.build(liveServerLayer).pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const services = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: Board,
			handlers: Board.application.toLayer({
				"board.shown": () =>
					Effect.gen(function* () {
						// The value is read before the gate, as a read that began before a later write would see it.
						const value = host.value;
						yield* pass(reads);
						return value;
					}),
				"board.touch": () => Effect.void,
				"board.write": ({ value }) =>
					Effect.gen(function* () {
						yield* pass(writes);
						if (host.refusing) {
							return yield* new Conflict({ message: "The board refuses writes" });
						}
						host.value = value;
					}),
			}),
			policy: "loopback",
			services: Layer.mergeAll(
				Layer.succeedContext(live),
				Layer.succeed(Reactivity.Reactivity, reactivity),
				// While the host's listener is down, nothing a command publishes reaches its streams.
				Layer.succeed(CommandPublication, {
					publish: (keys, sync) => Effect.suspend(() => (host.listening ? local.publish(keys, sync) : Effect.void)),
					recover: local.recover,
				}),
			),
		}),
	);
	const server = Context.get(services, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP listener");
	}
	const url = `http://127.0.0.1:${server.address.port}/rpc`;
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const sockets = trackedSockets();
	const connections = yield* Queue.unbounded<"connected" | "disconnected">();
	runtime.addGlobalLayer(
		Layer.succeed(RpcClient.ConnectionHooks, {
			onConnect: Effect.asVoid(Queue.offer(connections, "connected")),
			onDisconnect: Effect.asVoid(Queue.offer(connections, "disconnected")),
		}),
	);
	const native = syntheticNative();
	const tab = makeClient(Board, { resume: native.source, runtime, url, webSocketConstructor: sockets.layer });
	function run<A, E>(effect: Effect.Effect<A, E, Effect.Services<ReturnType<typeof tab.api.touch.run>>>) {
		return AtomRegistry.getResult(registry, tab.runtime.atom(effect).pipe(Atom.setIdleTTL(0)));
	}
	const states = yield* SubscriptionRef.make<readonly string[]>([]);
	function viewer(name: string | undefined) {
		return Effect.gen(function* () {
			const socket = RpcClient.layerProtocolSocket().pipe(Layer.provide([layerWebSocket(url.replace(/^http/u, "ws")), RpcSerialization.layerNdjson]));
			const client = yield* RpcClient.make(Board, { flatten: true }).pipe(Effect.provideContext(yield* Layer.build(socket)));
			const frames = yield* SubscriptionRef.make<readonly string[]>([]);
			yield* client(
				"board.$changes",
				{ queries: [{ payload: undefined, query: "shown" }] },
				name === undefined ? {} : { headers: { "x-shivaedev-sync": name } },
			).pipe(
				Stream.runForEach((frame) => SubscriptionRef.update(frames, (seen) => [...seen, updateWords(frame)])),
				Effect.forkScoped,
			);
			return { client, frames };
		});
	}
	const flight: { command: Fiber.Fiber<string> | undefined } = { command: undefined };
	return {
		activity: clientActivity(tab),
		connections,
		flight,
		host,
		live: Context.get(live, LiveServer),
		native,
		reads,
		registry,
		run,
		sockets,
		states,
		tab,
		view: tab.api.shown.query(),
		viewer,
		viewers: new Map<Viewer, Effect.Success<ReturnType<typeof viewer>>>(),
		writes,
	};
});

export type Viewer = "an older client" | "another tab";

export type ReflectionEngine = Effect.Success<typeof reflectionEngine>;
