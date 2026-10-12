import { Effect } from "effect";
import { Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import type { EngineState } from "#engine/makeState.ts";
import type { WorkResult } from "#policy.ts";

export function reserveRenewal({ store }: EngineState) {
	return Effect.fn("Fleet.reserveRenewal")(function* (previous: WorkResult | undefined, current: WorkResult) {
		for (const result of [previous, current]) {
			if (result?.kind === "change") {
				yield* store.reserveForeign(result.pr, { backlog: true, executing: false });
			}
		}
		if (previous?.kind === "change" && (current.kind !== "change" || current.pr !== previous.pr)) {
			return yield* Effect.fail(
				new Forbidden({ message: "Existing PR identity changed; retained known reservations pending an ownership decision" }),
			);
		}
	});
}
