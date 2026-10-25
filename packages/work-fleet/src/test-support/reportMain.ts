import { Effect } from "effect";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { HEAD } from "#test/githubResult.ts";
import { mainObservation } from "#test/preparation.ts";

export const reportMain = engineConfiguration("research uses the dispatched main commit", () => ({
	mainQuery: (preparation) => Effect.succeed(mainObservation({ fromRevision: preparation.baseRevision, revision: HEAD })),
}));
