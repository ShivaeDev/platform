import { Clock, Effect, type Fiber, Layer, Queue } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { RpcClient, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { makeClient } from "#bind.ts";
import { clientActivity } from "#clientActivity.ts";
import { SocketClock } from "#SocketClock.ts";
import { Counter } from "#test/commands/Counter.ts";
import { openHost } from "#test/commands/openHost.ts";
import { syntheticNative, syntheticWindow } from "#test/resumeSources.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

export const commandEngine = Effect.gen(function* () {
	const host = yield* openHost;
	const runtime = yield* storyRuntime;
	runtime.addGlobalLayer(Layer.succeed(SocketClock, yield* Clock.Clock));
	const events = yield* Queue.unbounded<string>();
	runtime.addGlobalLayer(
		Layer.succeed(RpcClient.ConnectionHooks, {
			onConnect: Queue.offer(events, "connected").pipe(Effect.asVoid),
			onDisconnect: Queue.offer(events, "disconnected").pipe(Effect.asVoid),
		}),
	);
	const browser = syntheticWindow();
	const native = syntheticNative();
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	function connect(
		custom: boolean,
		protocol = RpcClient.layerProtocolSocket().pipe(
			Layer.provide(Socket.layerWebSocket(host.url.replace(/^http/u, "ws")).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal))),
			Layer.provide(RpcSerialization.layerNdjson),
		),
	) {
		const client = makeClient(Counter, {
			live: false,
			...(custom ? { protocol } : {}),
			resume: native.source,
			resumeWindow: browser.window,
			runtime,
			url: host.url,
		});
		function run<A, E>(effect: Effect.Effect<A, E, Effect.Services<ReturnType<typeof client.api.add.run>>>) {
			return AtomRegistry.getResult(registry, client.runtime.atom(effect).pipe(Atom.setIdleTTL(0)));
		}
		return { activity: clientActivity(client), client, protocol, run };
	}
	const state: { connection?: ReturnType<typeof connect>; command?: Fiber.Fiber<number, unknown> } = {};
	function connection() {
		if (state.connection === undefined) {
			throw new Error("Connect the client first");
		}
		return state.connection;
	}
	return { browser, connect, connection, events, host, native, registry, state };
});
