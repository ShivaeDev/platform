import { Effect } from "effect";
import { engineIntegrations } from "#test/engineIntegrations.ts";
import { engineProvider } from "#test/engineProvider.ts";
import { host } from "#test/hostStory.ts";
import { mainObservation } from "#test/preparation.ts";

export const independentScheduler = host.trait("configuration", "an independent scheduler keeps worker and reviewer turns running", (engine) => {
	engine.scheduled = true;
	const provider = engineProvider({ reviewRunning: true }, engine.reviews);
	engine.providerFixture = provider;
	engine.provider = provider.transport;
	engine.integrations = engineIntegrations(
		{
			denyDelivery: true,
			mainQuery: (preparation) => Effect.succeed(mainObservation({ fromRevision: preparation.baseRevision, revision: preparation.baseRevision })),
		},
		[],
	);
});
