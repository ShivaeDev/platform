import { Effect, Layer } from "effect";
import type { FleetError } from "#errors.ts";
import { type MainSnapshot, MainSource, unchanged } from "#host/mainSource.ts";

export const MAIN = { observedAt: 1, revision: "a".repeat(40) };

interface FixedMainOptions {
	readonly current?: Effect.Effect<MainSnapshot, FleetError>;
	readonly refresh?: Effect.Effect<MainSnapshot, FleetError>;
	readonly repositoryRoot?: string;
}

export function fixedMainSource({
	current = Effect.succeed(MAIN),
	refresh = current,
	repositoryRoot = "/synthetic-repository",
}: FixedMainOptions = {}) {
	return Layer.succeed(MainSource)({
		current,
		latest: refresh,
		observe: (preparation) => Effect.succeed(unchanged(preparation.baseRevision, MAIN)),
		refresh,
		repositoryRoot,
	});
}

export function movingMainSource(snapshot: () => MainSnapshot, repositoryRoot = "/synthetic-repository") {
	const current = Effect.sync(snapshot);
	return Layer.succeed(MainSource)({
		current,
		latest: current,
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
		repositoryRoot,
	});
}
