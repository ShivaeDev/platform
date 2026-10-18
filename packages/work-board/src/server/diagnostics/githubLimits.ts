import { Effect } from "effect";
import type { FleetHealth } from "#diagnostics/health.ts";
import { type Source, SourceFailure } from "#diagnostics/source.ts";

export function githubLimits(fleet: Source<FleetHealth>) {
	return fleet.pipe(
		Effect.flatMap(({ github }) =>
			github === undefined || github.length === 0
				? Effect.fail(new SourceFailure({ kind: "not-configured", message: "Fleet has not recorded a GitHub response yet" }))
				: Effect.succeed(github),
		),
	);
}
