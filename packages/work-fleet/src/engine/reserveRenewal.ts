import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { FleetFailure, type WorkResult } from "#policy.ts";

export function reserveRenewal({ store }: EngineState) {
	return Effect.fn("Fleet.reserveRenewal")(function* (previous: WorkResult | undefined, current: WorkResult) {
		for (const result of [previous, current]) {
			if (result?.kind === "change") {
				yield* store.reserveForeign(result.pr, result.paths, { backlog: true, executing: false, preservePaths: true });
			}
		}
		if (previous?.kind === "change" && (current.kind !== "change" || current.pr !== previous.pr)) {
			return yield* Effect.fail(
				new FleetFailure({
					message: "Existing PR identity changed; retained known reservations pending an ownership decision",
					reason: "denied",
				}),
			);
		}
	});
}
