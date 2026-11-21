import { Clock, Effect, type Fiber, Layer, Queue, Stream, SubscriptionRef } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { type Rpc, RpcClient, type RpcGroup, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { rpcSocketHost } from "@shivaedev/test-story/server/rpcSocketHost.ts";
import { clientActivity } from "#clientActivity.ts";
import { makeClient } from "#makeClient.ts";
import { SocketClock } from "#SocketClock.ts";
import { Counter } from "#test/commands/Counter.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

type Frame = Rpc.SuccessChunk<Rpc.ExtractTag<RpcGroup.Rpcs<typeof Counter>, "counter.$changes">>;

export const olderHostEngine = Effect.gen(function* () {
	const frames = yield* Queue.unbounded<Frame>();
	const subscribed = yield* Queue.unbounded<void>();
	const counter = { value: 0 };
	const syncIds: string[] = [];
	// This host serves the contract alone: it has no sync command and sends only the frames the story scripts.
	const host = yield* rpcSocketHost(
		Counter,
		Counter.toLayer({
			"counter.$changes": () => Stream.unwrap(Effect.as(Queue.offer(subscribed, undefined), Stream.fromQueue(frames))),
			"counter.add": ({ amount }, { headers }) =>
				Effect.sync(() => {
					const named = headers["x-shivaedev-sync"];
					if (named !== undefined) {
						syncIds.push(named);
					}
					counter.value += amount;
					return counter.value;
				}),
			"counter.value": () => Effect.sync(() => counter.value),
		}),
	);
	const runtime = yield* storyRuntime;
	runtime.addGlobalLayer(Layer.succeed(SocketClock, yield* Clock.Clock));
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	function connect(custom: boolean) {
		const protocol = RpcClient.layerProtocolSocket().pipe(
			Layer.provide(Socket.layerWebSocket(host.url.replace(/^http/u, "ws")).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal))),
			Layer.provide(RpcSerialization.layerNdjson),
		);
		const tab = makeClient({ counter: Counter }, { ...(custom ? { protocol } : {}), runtime, url: host.url });
		function run<A, E>(effect: Effect.Effect<A, E, Effect.Services<ReturnType<typeof tab.api.counter.add.run>>>) {
			return AtomRegistry.getResult(registry, tab.runtime.atom(effect).pipe(Atom.setIdleTTL(0)));
		}
		return { activity: clientActivity(tab), run, tab, view: tab.api.counter.value.query() };
	}
	const flight: { command: Fiber.Fiber<string> | undefined } = { command: undefined };
	const connection: { current: ReturnType<typeof connect> | undefined } = { current: undefined };
	return { connect, connection, counter, flight, frames, registry, states: yield* SubscriptionRef.make<readonly string[]>([]), subscribed, syncIds };
});

export type OlderHostEngine = Effect.Success<typeof olderHostEngine>;
