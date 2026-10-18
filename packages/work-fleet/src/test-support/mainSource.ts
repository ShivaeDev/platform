import { Effect, Layer } from "effect";
import type { FleetError } from "#errors.ts";
import { type MainSnapshot, MainSource, unchanged } from "#host/mainSource.ts";

export const MAIN = { observedAt: 1, revision: "main-revision" };

export function fixedMainSource(current: Effect.Effect<MainSnapshot, FleetError> = Effect.succeed(MAIN)) {
	return Layer.succeed(MainSource)({
		current,
		observe: (preparation) => Effect.succeed(unchanged(preparation.baseRevision, MAIN)),
		refresh: current,
		repositoryRoot: "/synthetic-repository",
	});
}

export function movingMainSource(snapshot: () => MainSnapshot) {
	const current = Effect.sync(snapshot);
	return Layer.succeed(MainSource)({
		current,
		observe: (preparation) =>
			Effect.map(current, (main) => ({
				...main,
				ancestor: true,
				changedPaths: preparation.baseRevision === main.revision ? [] : ["src/changed.ts"],
				complete: true,
				configurationChanges: [],
				fromRevision: preparation.baseRevision,
			})),
		refresh: current,
		repositoryRoot: "/synthetic-repository",
	});
}
