import { Effect } from "effect";
import type { FleetRecord } from "#model.ts";
import type { BoardWork } from "#policy.ts";
import { qualifyDependencies } from "#qualifyDependencies.ts";

export function qualifyAreaWaiter(work: BoardWork, records: readonly FleetRecord[], get: Parameters<typeof qualifyDependencies>[2]) {
	return qualifyDependencies(work.dependsOn, records, get).pipe(
		Effect.as(work.approved),
		Effect.catchTag("Forbidden", () => Effect.succeed(false)),
	);
}
