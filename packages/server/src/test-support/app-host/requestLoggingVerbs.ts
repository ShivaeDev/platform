import { Deferred, Effect } from "effect";
import { TestClock } from "effect/testing";
import { requests } from "#test/app-host/requests.ts";
import type { HostState } from "#test/app-host/state.ts";

export function requestLoggingVerbs(state: HostState, tell: (line: string) => void) {
	return {
		requestSlowRoute: () => {
			const timing = state.requestLogging;
			if (timing === undefined) {
				throw new Error("Declare loggedApplicationRoutes before requesting its held handler");
			}
			tell("the client requests a route whose handler takes 25 ms");
			return Effect.all(
				[
					requests(state, tell).request("/slow"),
					Effect.gen(function* () {
						yield* Deferred.await(timing.started);
						yield* TestClock.adjust("25 millis");
						yield* Deferred.succeed(timing.release, undefined);
					}),
				],
				{ concurrency: "unbounded" },
			).pipe(Effect.asVoid);
		},
	};
}
