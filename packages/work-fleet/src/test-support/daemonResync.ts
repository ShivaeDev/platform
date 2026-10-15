import { expect } from "@effect/vitest";
import { Deferred, Effect, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { AppChanges } from "@shivaedev/platform/appHost.ts";
import { daemonClient } from "#host/daemonClient.ts";
import { until } from "#test/cloudRestart.ts";
import type { HostFixture } from "#test/fleetHost.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { statusRecord } from "#test/status.ts";
import { storeState } from "#test/storeState.ts";

export const daemonResync = Effect.fn("DaemonTest.daemonResync")(function* (fixture: HostFixture) {
	yield* storeState(fixture.host, "one", statusRecord("one"));
	return yield* withReadDaemon(
		fixture.host,
		(port) =>
			Effect.gen(function* () {
				const client = yield* daemonClient(port);
				const ready = yield* Deferred.make<void>();
				const stages: (string | undefined)[] = [];
				yield* client("daemon.follow", { follow: true, workIds: ["one"] }).pipe(
					Stream.tap((states) => Effect.sync(() => stages.push(states[0]?.stage))),
					Stream.tap(() => Deferred.succeed(ready, undefined)),
					Stream.runDrain,
					Effect.forkScoped,
				);
				yield* Deferred.await(ready);
				yield* storeState(fixture.host, "one", statusRecord("one", "completed")).pipe(
					Effect.provideService(Reactivity.Reactivity, yield* Reactivity.make),
				);
				yield* Effect.sleep("100 millis");
				expect(stages).toEqual(["executing"]);
				yield* (yield* AppChanges).resync;
				yield* until(() => Effect.succeed(stages.length === 2));
				expect(stages).toEqual(["executing", "completed"]);
			}),
		fixture.parts,
	);
});
