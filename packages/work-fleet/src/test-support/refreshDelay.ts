import { Deferred, Effect, Layer } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { MainSource, unchanged } from "#host/mainSource.ts";
import { type HostFixture, MAIN } from "#test/fleetHost.ts";

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
			main: Layer.succeed(MainSource)({
				current: refresh,
				observe: (preparation) => Effect.succeed(unchanged(preparation.baseRevision, MAIN)),
				refresh,
				repositoryRoot: "/synthetic-repository",
			}),
		},
		release: Deferred.succeed(release, undefined),
	};
});
