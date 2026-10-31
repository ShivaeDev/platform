import { Effect } from "effect";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import type { FleetError } from "#errors.ts";
import type { MainSnapshot } from "#host/mainSource.ts";
import type { NoChangeResult } from "#policy.ts";

export function noChangeChecks(
	latestMain: Effect.Effect<MainSnapshot, FleetError>,
	isAncestor: (base: string, revision: string) => Effect.Effect<boolean, FleetError>,
) {
	return Effect.fn("Fleet.noChangeChecks")(function* (result: typeof NoChangeResult.Type) {
		const latest = yield* latestMain;
		if (result.head !== latest.revision && !(yield* isAncestor(result.head, latest.revision))) {
			return yield* new Conflict({ message: "The reported no-change commit is not on main" });
		}
		return {
			evidence: [`No-change commit ${result.head} is on main at ${latest.revision}`],
			head: result.head,
			passed: true,
		};
	});
}
