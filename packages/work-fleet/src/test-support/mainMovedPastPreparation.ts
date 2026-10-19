import { Effect } from "effect";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { mainObservation } from "#test/preparation.ts";

export function mainMovedPastPreparation(line: string, observation: Parameters<typeof mainObservation>[0] = {}) {
	return engineConfiguration(`main moved past the preparation: ${line}`, () => ({
		mainQuery: (preparation) =>
			Effect.succeed(mainObservation({ changedPaths: ["src/changed.ts"], fromRevision: preparation.baseRevision, ...observation })),
	}));
}
