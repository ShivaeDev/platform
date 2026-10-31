import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { LiveServer } from "@shivaedev/contract/LiveServer.ts";
import type { FleetRecord } from "#model.ts";
import { until } from "#test/cloudRestart.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { storeState } from "#test/storeState.ts";

export function daemonResync(engine: HostStoryEngine) {
	return {
		awaitSnapshots: (count: number) => until(() => Effect.succeed(engine.snapshots.length >= count)),
		commitWithoutHint: (record: FleetRecord) =>
			Effect.gen(function* () {
				const reactivity = yield* Reactivity.make;
				yield* storeState(engine.fixture.host, record.workId, record).pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
			}),
		resync: () => Effect.flatMap(LiveServer, (changes) => changes.resync()).pipe(Effect.provideContext(engine.running.context)),
	};
}
