import { Clock, Deferred, Effect, Layer, Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { RpcClientError } from "effect/rpc/RpcClientError";
import { SocketReadError } from "effect/socket/Socket";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { type LiveHint, live } from "#live.ts";

const disconnected = new RpcClientError({ reason: new SocketReadError({ cause: new Error("connection dropped") }) });
const retryEngine = Effect.gen(function* () {
	const clock = yield* Clock.Clock;
	const runtime = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() })(Layer.succeed(Clock.Clock, clock));
	const state: { mode: "online" | "transport drop" | "server outage"; dropped: Deferred.Deferred<never, RpcClientError> } = {
		dropped: yield* Deferred.make<never, RpcClientError>(),
		mode: "online",
	};
	const attempts: number[] = [];
	const stream = Stream.unwrap(
		Effect.sync(() => {
			attempts.push(clock.currentTimeMillisUnsafe());
			if (state.mode === "transport drop") {
				return Stream.fail(disconnected);
			}
			if (state.mode === "server outage") {
				return Stream.die(new Error("server unavailable"));
			}
			return Stream.concat(Stream.succeed<LiveHint>({ _tag: "Resync" }), Stream.drain(Stream.fromEffect(Deferred.await(state.dropped))));
		}),
	);
	const subscription = live(runtime, { resyncKeys: [], stream });
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(value) => Effect.sync(() => value.dispose()),
	);
	registry.mount(subscription.connection);
	function waitForConnection(connection: "live" | "reconnecting") {
		return until(AtomRegistry.toStream(registry, subscription.status), (status) => status.connection === connection, {
			name: "live connection status",
		});
	}
	yield* waitForConnection("live");
	return { attempts, registry, state, subscription, waitForConnection };
});
export const liveRetryStory = storyKit({
	clock: "test",
	create: () => retryEngine,
	inspect: ({ attempts, state }) => ({ attempts, mode: state.mode }),
	name: "live transport recovery",
	stages: [],
	verbs: (engine, story) => ({
		attempts: () => Effect.sync(() => engine.attempts.length),
		connection: () => Effect.sync(() => engine.registry.get(engine.subscription.status).connection),
		drop: (mode: "transport drop" | "server outage") =>
			Effect.gen(function* () {
				story.tell(`the live connection suffers a ${mode}`);
				engine.state.mode = mode;
				yield* Deferred.fail(engine.state.dropped, disconnected);
				yield* engine.waitForConnection("reconnecting");
			}),
		restore: () =>
			Effect.gen(function* () {
				story.tell("the server and transport become available again");
				engine.state.dropped = yield* Deferred.make<never, RpcClientError>();
				engine.state.mode = "online";
			}),
		retryIntervals: () => Effect.sync(() => engine.attempts.slice(1).map((at, index) => at - (engine.attempts[index] ?? at))),
		secondsPass: (seconds: number) => {
			story.tell(`${seconds} seconds pass with the page open`);
			return TestClock.adjust(`${seconds} seconds`);
		},
	}),
});
