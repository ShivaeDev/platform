import { Deferred, Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import type { HostFixture } from "#test/fleetHost.ts";
import { fixedMainSource, MAIN } from "#test/mainSource.ts";

export const refreshDelay = Effect.fn("DaemonTest.refreshDelay")(function* (fixture: HostFixture, fail = false) {
	const entered = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	const refresh = Effect.gen(function* () {
		yield* Deferred.succeed(entered, undefined);
		yield* Deferred.await(release);
		return yield* fail ? Effect.fail(new ServiceUnavailable({ message: "Git refresh unavailable" })) : Effect.succeed(MAIN);
	});
	return {
		entered: Deferred.await(entered),
		parts: {
			...fixture.parts,
			main: fixedMainSource({ current: refresh, refresh }),
		},
		release: Deferred.succeed(release, undefined),
	};
});
