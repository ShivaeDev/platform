import { expect } from "@effect/vitest";
import { Context, Effect, Exit, Layer, Scope } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { HostFixture } from "#test/fleetHost.ts";
import { untilOutput, withFollower } from "#test/follower.ts";
import { readDaemonLayer } from "#test/readDaemon.ts";
import { storeState } from "#test/storeState.ts";

export const watchReconnect = Effect.fn("WatchReconnectTest.watchReconnect")(function* (fixture: HostFixture, ids: readonly string[]) {
	for (const [id, stage] of [
		["done", "completed"],
		["gone", "released"],
		["active", "executing"],
	] as const) {
		yield* storeState(fixture.host, id, { stage });
	}
	yield* storeState(fixture.host, "waiting", {
		decision: { attentionOwner: "maintainer", code: "reviewed-pr-ready", reason: "Reviewed PR is ready to merge" },
		stage: "needs-human",
	});
	const initial = "waiting needs-human (waiting on maintainer): Reviewed PR is ready to merge\n";
	function start(port: number) {
		return Effect.gen(function* () {
			const snapshot = Promise.withResolvers<void>();
			const scope = yield* Scope.make();
			yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
			const context = yield* Layer.buildWithScope(
				readDaemonLayer(fixture.host, fixture.parts, port, () => snapshot.resolve()),
				scope,
			);
			const address = Context.get(context, HttpServer.HttpServer).address;
			if (!NetAddress.isInetAddress(address)) {
				return yield* Effect.die("Expected a TCP daemon");
			}
			return { context, port: address.port, snapshot: snapshot.promise, stop: Scope.close(scope, Exit.void) };
		});
	}
	const first = yield* start(0);
	yield* withFollower(fixture.configFile, "watch", ids, { follow: true, interval: 0.1, port: first.port }, (follower) =>
		Effect.gen(function* () {
			yield* Effect.promise(() => first.snapshot);
			yield* untilOutput(follower, initial);
			yield* Effect.sleep("100 millis");
			expect(follower.output()).toBe(initial);
			yield* storeState(fixture.host, "active", { stage: "released" }).pipe(
				Effect.provideService(Reactivity.Reactivity, Context.get(first.context, Reactivity.Reactivity)),
			);
			yield* untilOutput(follower, "active released\n");
			yield* first.stop;
			const unchanged = yield* start(first.port);
			yield* Effect.promise(() => unchanged.snapshot);
			yield* Effect.sleep("100 millis");
			expect(follower.output()).toBe(`${initial}active released\n`);
			yield* unchanged.stop;
			yield* storeState(fixture.host, "active", { stage: "completed" });
			const changed = yield* start(first.port);
			yield* Effect.promise(() => changed.snapshot);
			yield* untilOutput(follower, "active completed\n");
			yield* Effect.sleep("100 millis");
			expect(follower.output()).toBe(`${initial}active released\nactive completed\n`);
			yield* storeState(fixture.host, "active", {
				decision: { attentionOwner: "maintainer", code: "reviewed-pr-ready", id: "after-restart", reason: "Reviewed PR is ready to merge" },
				stage: "needs-human",
			}).pipe(Effect.provideService(Reactivity.Reactivity, Context.get(changed.context, Reactivity.Reactivity)));
			const live = "active needs-human (waiting on maintainer): Reviewed PR is ready to merge\n";
			yield* untilOutput(follower, live).pipe(Effect.timeout("5 seconds"));
			expect(follower.output()).toBe(`${initial}active released\nactive completed\n${live}`);
			expect(follower.isRunning()).toBe(true);
		}),
	);
}, Effect.scoped);
