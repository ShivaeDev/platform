import { expect } from "@effect/vitest";
import { Context, Effect, Exit, Layer, Scope } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { type HostFixture, withHost } from "#test/fleetHost.ts";
import { untilError, untilOutput, withFollower } from "#test/follower.ts";
import { postgresTests } from "#test/postgres.ts";
import { readDaemonLayer, withReadDaemon } from "#test/readDaemon.ts";
import { storeState } from "#test/storeState.ts";

const test = postgresTests("live");

const observeTransition = Effect.fn("DaemonDiscoveryTest.observeTransition")(function* (
	fixture: HostFixture,
	port: number,
	subscribed: Promise<void>,
) {
	yield* withFollower(fixture.configFile, "watch", [], { discover: true, follow: true, port }, (follower) =>
		Effect.gen(function* () {
			yield* Effect.promise(() => subscribed).pipe(Effect.timeout("5 seconds"));
			yield* storeState(fixture.host, "one", { stage: "completed" });
			yield* untilOutput(follower, "one completed\n");
			expect(follower.output()).toBe("one completed\n");
			expect(follower.errors()).toBe("");
		}),
	);
});

test("watch without --port discovers the daemon's bound port and receives a live transition", () =>
	withHost({}, {}, (fixture) => {
		const subscribed = Promise.withResolvers<void>();
		return withReadDaemon(fixture.host, (port) => observeTransition(fixture, port, subscribed.promise), { onSnapshot: () => subscribed.resolve() });
	}));

const retryAndRecover = Effect.fn("DaemonDiscoveryTest.retryAndRecover")(function* (fixture: HostFixture) {
	const stopped = yield* Scope.make();
	yield* Effect.addFinalizer(() => Scope.close(stopped, Exit.void));
	yield* Layer.buildWithScope(readDaemonLayer(fixture.host), stopped);
	yield* Scope.close(stopped, Exit.void);
	const subscribed = Promise.withResolvers<void>();
	yield* withFollower(fixture.configFile, "watch", [], { discover: true, follow: true, interval: 0.05, port: 0 }, (follower) =>
		Effect.gen(function* () {
			yield* untilError(follower, "retrying in 0.05s\n");
			const line = follower.errors().split("\n")[0];
			expect(line).toContain("work-fleet: ERROR No Fleet daemon is running at 127.0.0.1:");
			yield* untilError(follower, `${line}\n`.repeat(3));
			expect(follower.isRunning()).toBe(true);
			const restarted = yield* Layer.build(readDaemonLayer(fixture.host, { onSnapshot: () => subscribed.resolve() }));
			yield* Effect.promise(() => subscribed.promise).pipe(Effect.timeout("5 seconds"));
			yield* storeState(fixture.host, "one", { stage: "released" }).pipe(
				Effect.provideService(Reactivity.Reactivity, Context.get(restarted, Reactivity.Reactivity)),
			);
			yield* untilOutput(follower, "one released\n");
			expect(follower.output()).toBe("one released\n");
		}),
	);
});

test("watch without --port repeats an error on each unreachable retry and discovers a restarted daemon on a new port", () =>
	withHost({}, {}, retryAndRecover));
